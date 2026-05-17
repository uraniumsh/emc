// ==========================================
// EL MOTOR DEL LENGUAJE "emc" Y EDITOR
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    
    // ELEMENTOS DEL DOM
    const editor = document.getElementById('codeEditor');
    const highlighting = document.getElementById('codeHighlighting');
    const lineNumbers = document.getElementById('lineNumbers');
    const terminal = document.getElementById('terminalOutput');
    const btnRun = document.getElementById('btnRunCode');
    const btnClearConsole = document.getElementById('btnClearConsole');
    const btnClearCode = document.getElementById('btnClearCode');

    // CÓDIGO INICIAL DE EJEMPLO
    const startCode = 
`o = 2
Write(o)
If (o < 1) {
    write("No")
} Else {
    write("yeah")
}`;
    
    editor.value = startCode;

    // ==========================================
    // LÓGICA DEL EDITOR Y SINTAXIS (VS CODE STYLE)
    // ==========================================

    function updateEditor() {
        const text = editor.value;
        
        // Actualizar números de línea
        const linesCount = text.split('\n').length;
        let linesHtml = '';
        for (let i = 1; i <= linesCount; i++) {
            linesHtml += `<div>${i}</div>`;
        }
        lineNumbers.innerHTML = linesHtml;

        // Actualizar colores (Sintaxis)
        highlighting.innerHTML = highlightEMC(text);
    }

    function highlightEMC(text) {
        // 1. Separar el texto en tokens y espacios manteniendo todo intacto
        let tokens = text.split(/(\s+|"[^"]*"|'[^']*'|\d+|[A-Za-z_]\w*|[=+\-*/<>(){},;])/g).filter(Boolean);
        
        return tokens.map(token => {
            if (/^\s+$/.test(token)) return token; // Mantener espacios y saltos de línea
            
            // Proteger HTML interno (<, >, &)
            let safeToken = token.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // Strings
            if (token.startsWith('"') || token.startsWith("'")) return `<span class="token-string">${safeToken}</span>`;
            // Números
            if (/^\d+$/.test(token)) return `<span class="token-number">${safeToken}</span>`;
            
            // Palabras clave (No importa si están en mayúscula o minúscula)
            const lowerToken = token.toLowerCase();
            if (['if', 'else', 'while', 'elseif', 'for'].includes(lowerToken)) return `<span class="token-keyword">${safeToken}</span>`;
            if (lowerToken === 'write') return `<span class="token-function">${safeToken}</span>`;
            
            // Variables
            if (/^[A-Za-z_]\w*$/.test(token)) return `<span class="token-identifier">${safeToken}</span>`;
            
            // Llaves y operadores
            if (['(', ')', '{', '}'].includes(token)) return `<span class="token-brace">${safeToken}</span>`;
            if (['=', '+', '-', '*', '/', '<', '>', '==', '!='].includes(token)) return `<span class="token-operator">${safeToken}</span>`;
            
            return safeToken;
        }).join('');
    }

    // Sincronizar el Scroll (Cuando bajas en el editor, bajan los colores y los números)
    editor.addEventListener('scroll', () => {
        highlighting.scrollTop = editor.scrollTop;
        highlighting.scrollLeft = editor.scrollLeft;
        lineNumbers.scrollTop = editor.scrollTop;
    });

    // Soporte para la tecla TAB
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.value = editor.value.substring(0, start) + "    " + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + 4;
            updateEditor();
        }
    });

    editor.addEventListener('input', updateEditor);
    
    // Iniciar editor
    updateEditor();

    // ==========================================
    // LÓGICA DE LA TERMINAL E INTERFAZ
    // ==========================================

    function printToTerminal(text, type = "output-msg") {
        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        line.innerText = text;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    btnClearConsole.addEventListener('click', () => {
        terminal.innerHTML = '<div class="terminal-line system-msg">>> Consola limpia.</div>';
    });

    btnClearCode.addEventListener('click', () => {
        if(confirm("¿Seguro que deseas borrar todo el código?")) {
            editor.value = "";
            updateEditor();
        }
    });

    btnRun.addEventListener('click', () => {
        printToTerminal("\n>> Ejecutando...", "system-msg");
        const code = editor.value;
        runEMC(code, printToTerminal);
    });
});

// ==========================================
// EL INTÉRPRETE "emc" (EL CEREBRO DEL LENGUAJE)
// ==========================================

function runEMC(code, printFn) {
    const env = {}; // Memoria RAM

    // Convertir el texto en tokens procesables
    function tokenize(input) {
        const regex = /("[^"]*"|'[^']*'|\d+|[A-Za-z_]\w*|==|!=|<=|>=|[=+\-*/<>(){},])/g;
        const tokens = [];
        let match;
        while ((match = regex.exec(input)) !== null) {
            tokens.push(match[0]);
        }
        return tokens;
    }

    const tokens = tokenize(code);
    let current = 0;

    function peek() { return tokens[current]; }
    function consume() { return tokens[current++]; }

    // MATEMÁTICAS Y VARIABLES
    function evaluateExpression() {
        let token = consume();
        if (!token) return null;

        // Limpiar strings
        if (token.startsWith('"') || token.startsWith("'")) {
            return token.substring(1, token.length - 1);
        }
        
        let left;
        // Identificar si es un número o una variable guardada
        if (!isNaN(token)) {
            left = parseFloat(token);
        } else if (env[token] !== undefined) {
            left = env[token]; // Usa el caso exacto de la variable
        } else {
            throw new Error(`Variable no definida: '${token}'`);
        }

        // Si hay un operador, calcula la operación
        const next = peek();
        if (next === '+' || next === '-' || next === '*' || next === '/' || next === '<' || next === '>' || next === '==' || next === '!=') {
            const op = consume();
            const right = evaluateExpression();
            if (op === '+') return left + right;
            if (op === '-') return left - right;
            if (op === '*') return left * right;
            if (op === '/') return left / right;
            if (op === '<') return left < right;
            if (op === '>') return left > right;
            if (op === '==') return left === right;
            if (op === '!=') return left !== right;
        }
        return left;
    }

    // BLOQUES CON LLAVES {}
    function parseBlock(execute) {
        if (consume() !== '{') throw new Error("Se esperaba '{'");
        while (current < tokens.length && peek() !== '}') {
            parseStatement(execute);
        }
        if (consume() !== '}') throw new Error("Se esperaba '}'");
    }

    // EL NÚCLEO: LEE LAS INSTRUCCIONES
    function parseStatement(execute = true) {
        const token = peek();
        if (!token) return;

        // Revisamos si el siguiente token es un igual '=', eso significa que es una variable: x = 10
        if (tokens[current + 1] === '=') {
            const varName = consume(); // Guarda el nombre (ej. 'o') respetando mayúsculas/minúsculas
            consume(); // Quita el '='
            const val = evaluateExpression();
            if (execute) env[varName] = val; // Guarda en memoria
            return;
        }

        // AQUÍ ESTÁ EL PARCHE: Convertimos el token a minúsculas solo para comandos
        const lowerToken = token.toLowerCase();

        // COMANDO: write()
        if (lowerToken === 'write') {
            consume(); 
            if (consume() !== '(') throw new Error("write lleva '('");
            const val = evaluateExpression();
            if (consume() !== ')') throw new Error("Falta ')' en write");
            
            if (execute) printFn("> " + val, "output-msg");
            return;
        }

        // COMANDO: if () {} else {}
        if (lowerToken === 'if') {
            consume(); 
            if (consume() !== '(') throw new Error("El if lleva '('");
            const condition = evaluateExpression();
            if (consume() !== ')') throw new Error("Falta ')' en el if");

            const isTrue = condition === true;
            parseBlock(execute && isTrue); // Corre el bloque solo si es verdadero

            // Revisa si la siguiente palabra es ELSE (sin importar si es Else, eLSe, etc)
            if (peek() && peek().toLowerCase() === 'else') {
                consume();
                parseBlock(execute && !isTrue);
            }
            return;
        }

        // COMANDO: while () {}
        if (lowerToken === 'while') {
            consume();
            const startOfCondition = current;
            if (consume() !== '(') throw new Error("El while lleva '('");
            let condition = evaluateExpression();
            if (consume() !== ')') throw new Error("Falta ')' en el while");

            const startOfBlock = current;
            
            if (!execute) { parseBlock(false); return; }

            while (condition === true) {
                current = startOfBlock; 
                parseBlock(true);
                current = startOfCondition; 
                consume(); condition = evaluateExpression(); consume(); 
            }
            
            current = startOfBlock;
            parseBlock(false); 
            return;
        }

        throw new Error(`Comando o sintaxis no reconocida: '${token}'`);
    }

    // EJECUCIÓN PRINCIPAL
    try {
        while (current < tokens.length) {
            parseStatement(true);
        }
        printFn(">> Ejecución finalizada con éxito.", "system-msg");
    } catch (err) {
        printFn("⚠️ ERROR: " + err.message, "error-msg");
    }
}
