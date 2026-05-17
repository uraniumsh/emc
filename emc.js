document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('codeEditor');
    const highlighting = document.getElementById('codeHighlighting');
    const lineNumbers = document.getElementById('lineNumbers');
    const terminal = document.getElementById('terminalOutput');
    const btnRun = document.getElementById('btnRunCode');
    const statusBadge = document.getElementById('statusBadge');

    // ==========================================
    // LISTA MAESTRA DE PALABRAS RESERVADAS emc
    // ==========================================
    const keywords = ['if', 'else', 'elseif', 'switch', 'case', 'default', 'while', 'do', 'for', 'in', 'of', 'break', 'continue', 'try', 'catch', 'finally'];
    const types = ['string', 'int', 'float', 'bool', 'list', 'obj', 'null', 'undefined'];
    const coreFuncs = [
        'write','input','clear','wait','stop','error','type','len','eval','itis',
        'tint','tfloat','tstring','tbool','isint','isfloat','isstring','isbool','islist','isnan',
        'abs','rup','rdown','rclose','max','min','random','pwr','sqrt','cbrt','pnoc','gmd','log','log10','exp','sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','hypot',
        'toupper','tolower','pm','gms','gmstar','gmsend','split','replace','rall','contains','startswith','endswith','indexof','lastindexof','substring','charat','charcodeat','fromcharcode','concat','repeat','padstart','padend','match','search','reversestr',
        'push','pop','unshift','shift','insert','removeat','removeval','join','reverselist','sort','slice','splice','concatlist','indexoflist','includeslist','map','filter','reduce','find','findindex','some','every','fill','flat','emptylist',
        'keys','values','entries','haskey','deletekey','mergeobj','cloneobj','freeze','isfrozen','sizeobj',
        'now','date','year','month','day','weekday','hours','minutes','seconds','isleapyear','adddays','diffdays','formattime','formatdate','parsedate',
        'base64encode','base64decode','jsonencode','jsondecode','urlencode','urldecode','hashmd5','hashsha256','uuid','hextobin',
        'fetch','ping','settimeout','setinterval','cleartimer','env','platform','version','beep','copy','prompt','rgbtohex','hextorgb','range','gcd','lcm','isprime','factorial','radtodeg','degtorad'
    ];

    // CÓDIGO INICIAL DE PRUEBA
    const startCode = 
`include emcweb;

write("=== PRUEBA DE emc_lang ===")
nombre = input("¿Cómo te llamas?")
write("Hola " + pm(nombre) + "!")

write("Esperando 2 segundos...")
wait(2000)

edad = 25
if (edad > 18) {
    write("Mayor de edad. Raíz de edad: " + sqrt(edad))
} else {
    write("Menor de edad")
}

for (i = 1; i <= 3; i++) {
    write("Conteo: " + i)
}`;
    editor.value = startCode;

    // ==========================================
    // RESALTADO DE SINTAXIS
    // ==========================================
    function updateEditor() {
        const text = editor.value;
        const linesCount = text.split('\n').length;
        let linesHtml = '';
        for (let i = 1; i <= linesCount; i++) linesHtml += `<div>${i}</div>`;
        lineNumbers.innerHTML = linesHtml;

        highlighting.innerHTML = highlightEMC(text);
    }

    function highlightEMC(text) {
        let tokens = text.split(/(\/\/.*|\s+|"[^"]*"|'[^']*'|\d+\.\d+|\d+|[A-Za-z_]\w*|[=+\-*/<>(){}\[\],;])/g).filter(Boolean);
        return tokens.map(token => {
            if (/^\s+$/.test(token)) return token;
            let safeToken = token.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            if (token.startsWith('//')) return `<span class="token-comment">${safeToken}</span>`;
            if (token.startsWith('"') || token.startsWith("'")) return `<span class="token-string">${safeToken}</span>`;
            if (/^\d+(\.\d+)?$/.test(token)) return `<span class="token-number">${safeToken}</span>`;
            
            const lowerToken = token.toLowerCase();
            if (lowerToken === 'include' || lowerToken === 'emcweb') return `<span class="token-include">${safeToken}</span>`;
            if (keywords.includes(lowerToken)) return `<span class="token-keyword">${safeToken}</span>`;
            if (types.includes(lowerToken)) return `<span class="token-type">${safeToken}</span>`;
            if (coreFuncs.includes(lowerToken)) return `<span class="token-function">${safeToken}</span>`;
            
            if (/^[A-Za-z_]\w*$/.test(token)) return `<span class="token-identifier">${safeToken}</span>`;
            if (['(', ')', '{', '}', '[', ']'].includes(token)) return `<span class="token-brace">${safeToken}</span>`;
            
            return safeToken;
        }).join('');
    }

    editor.addEventListener('scroll', () => { highlighting.scrollTop = lineNumbers.scrollTop = editor.scrollTop; highlighting.scrollLeft = editor.scrollLeft; });
    editor.addEventListener('input', updateEditor);
    
    // Auto-cierre de llaves y tabulaciones
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault(); const s = editor.selectionStart, end = editor.selectionEnd;
            editor.value = editor.value.substring(0, s) + "    " + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = s + 4; updateEditor();
        }
        if (e.key === '{') {
            e.preventDefault(); const s = editor.selectionStart;
            editor.value = editor.value.substring(0, s) + "{}" + editor.value.substring(s);
            editor.selectionStart = editor.selectionEnd = s + 1; updateEditor();
        }
    });

    updateEditor();

    // ==========================================
    // SISTEMA DE CONSOLA
    // ==========================================
    function printToTerminal(text, type = "output-msg") {
        const line = document.createElement('div'); line.className = `terminal-line ${type}`;
        line.innerText = String(text); terminal.appendChild(line); terminal.scrollTop = terminal.scrollHeight;
    }
    document.getElementById('btnClearConsole').addEventListener('click', () => { terminal.innerHTML = '<div class="terminal-line system-msg">>> Consola limpia.</div>'; });
    document.getElementById('btnClearCode').addEventListener('click', () => { if(confirm("¿Borrar todo el código?")) { editor.value = ""; updateEditor(); }});

    // ==========================================
    // MOTOR ASÍNCRONO DEL INTÉRPRETE emc
    // ==========================================
    btnRun.addEventListener('click', async () => {
        printToTerminal("\n>> Compilando...", "system-msg");
        statusBadge.innerText = "EJECUTANDO..."; statusBadge.className = "badge-ok badge-working";
        
        const rawCode = editor.value;
        
        try {
            await executeEMC(rawCode);
            printToTerminal(">> Ejecución finalizada con éxito.", "system-msg");
        } catch (err) {
            printToTerminal(`⚠️ ERROR: ${err.message}`, "error-msg");
        } finally {
            statusBadge.innerText = "COMPILADOR LISTO"; statusBadge.className = "badge-ok";
        }
    });

    // Ejecutor Transpilador: Convierte sintaxis emc a JS nativo y lo ejecuta en un entorno aislado (Sandbox)
    async function executeEMC(code) {
        // 1. Verificación de librería base
        let isWebIncluded = /include\s+emcweb\s*;?/i.test(code);
        let cleanCode = code.replace(/include\s+emcweb\s*;?/ig, ""); 
        if(isWebIncluded) printToTerminal(">> Librería [emcweb] enlazada.", "system-msg");

        // 2. Pre-Procesador: Hace que wait() y fetch() sean asíncronos nativamente y arregla variables implícitas
        // Convierte el código case-insensitive temporalmente para funciones, respetando strings
        let processedCode = cleanCode.replace(/\bwait\s*\(/ig, "await wait(");
        processedCode = processedCode.replace(/\bfetch\s*\(/ig, "await fetch(");
        processedCode = processedCode.replace(/\belseif\b/ig, "else if"); // Transforma elseif a JS
        
        // 3. LA LIBRERÍA ESTÁNDAR DE 150 FUNCIONES
        const stdLib = {
            // E/S
            write: (...args) => printToTerminal("> " + args.join(" ")),
            input: (msg) => prompt(msg || "Input requerido:"),
            clear: () => { terminal.innerHTML = ''; },
            wait: (ms) => new Promise(r => setTimeout(r, ms)),
            stop: () => { throw new Error("Ejecución detenida por stop()"); },
            error: (msg) => { throw new Error(msg); },
            type: (v) => Array.isArray(v) ? 'list' : typeof v,
            len: (v) => v ? v.length : 0,
            eval: (c) => eval(c),
            itis: (c) => { if(!c) throw new Error("Comprobación itis() falló."); return true; },
            
            // Tipos
            tint: (v) => parseInt(v), tfloat: (v) => parseFloat(v), tstring: (v) => String(v), tbool: (v) => Boolean(v),
            isint: Number.isInteger, isfloat: (v) => Number(v) === v && v % 1 !== 0, isstring: (v) => typeof v === 'string', isbool: (v) => typeof v === 'boolean', islist: Array.isArray, isnan: Number.isNaN,
            
            // Matemáticas
            abs: Math.abs, rup: Math.ceil, rdown: Math.floor, rclose: Math.round, max: Math.max, min: Math.min, random: Math.random, pwr: Math.pow, sqrt: Math.sqrt, cbrt: Math.cbrt, pnoc: Math.sign, gmd: Math.trunc, log: Math.log, log10: Math.log10, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, hypot: Math.hypot,
            
            // Strings
            toupper: (s) => String(s).toUpperCase(), tolower: (s) => String(s).toLowerCase(),
            pm: (s) => { s=String(s); return s.charAt(0).toUpperCase() + s.slice(1); },
            gms: (s) => String(s).trim(), gmstar: (s) => String(s).trimStart(), gmsend: (s) => String(s).trimEnd(),
            split: (s, d) => String(s).split(d), replace: (s, a, b) => String(s).replace(a,b), rall: (s, a, b) => String(s).replaceAll(a,b), contains: (s, x) => String(s).includes(x), startswith: (s, x) => String(s).startsWith(x), endswith: (s, x) => String(s).endsWith(x), indexof: (s, x) => String(s).indexOf(x), lastindexof: (s, x) => String(s).lastIndexOf(x), substring: (s, a, b) => String(s).substring(a,b), charat: (s, i) => String(s).charAt(i), charcodeat: (s, i) => String(s).charCodeAt(i), fromcharcode: String.fromCharCode, concat: (...args) => "".concat(...args), repeat: (s, n) => String(s).repeat(n), padstart: (s, l, f) => String(s).padStart(l,f), padend: (s, l, f) => String(s).padEnd(l,f), match: (s, r) => String(s).match(r), search: (s, r) => String(s).search(r), reversestr: (s) => String(s).split('').reverse().join(''),
            
            // Listas
            push: (l, v) => { l.push(v); return l; }, pop: (l) => l.pop(), unshift: (l, v) => { l.unshift(v); return l; }, shift: (l) => l.shift(), insert: (l, i, v) => { l.splice(i,0,v); return l; }, removeat: (l, i) => { l.splice(i,1); return l; }, removeval: (l, v) => { const i = l.indexOf(v); if(i>-1) l.splice(i,1); return l; }, join: (l, s) => l.join(s), reverselist: (l) => [...l].reverse(), sort: (l) => [...l].sort(), slice: (l, a, b) => l.slice(a,b), splice: (l, ...a) => { l.splice(...a); return l; }, concatlist: (a, b) => a.concat(b), indexoflist: (l, v) => l.indexOf(v), includeslist: (l, v) => l.includes(v), map: (l, c) => l.map(c), filter: (l, c) => l.filter(c), reduce: (l, c, i) => l.reduce(c, i), find: (l, c) => l.find(c), findindex: (l, c) => l.findIndex(c), some: (l, c) => l.some(c), every: (l, c) => l.every(c), fill: (l, v) => l.fill(v), flat: (l) => l.flat(), emptylist: (l) => { l.length = 0; return l; },
            
            // Objetos
            keys: Object.keys, values: Object.values, entries: Object.entries, haskey: (o, k) => o.hasOwnProperty(k), deletekey: (o, k) => { delete o[k]; return o; }, mergeobj: (a, b) => ({...a, ...b}), cloneobj: (o) => JSON.parse(JSON.stringify(o)), freeze: Object.freeze, isfrozen: Object.isFrozen, sizeobj: (o) => Object.keys(o).length,
            
            // Fechas
            now: Date.now, date: () => new Date().toString(), year: () => new Date().getFullYear(), month: () => new Date().getMonth() + 1, day: () => new Date().getDate(), weekday: () => ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'][new Date().getDay()], hours: () => new Date().getHours(), minutes: () => new Date().getMinutes(), seconds: () => new Date().getSeconds(), isleapyear: () => { const y = new Date().getFullYear(); return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0); }, adddays: (d, a) => new Date(new Date(d).getTime() + a*86400000), diffdays: (a, b) => Math.round(Math.abs((new Date(a) - new Date(b))/(86400000))), formattime: () => new Date().toLocaleTimeString(), formatdate: () => new Date().toLocaleDateString(), parsedate: (s) => Date.parse(s),
            
            // Extras
            base64encode: btoa, base64decode: atob, jsonencode: JSON.stringify, jsondecode: JSON.parse, urlencode: encodeURIComponent, urldecode: decodeURIComponent, hashmd5: (s) => "hash_simulado_"+s.length, hashsha256: (s) => "hash_simulado_"+s.length, uuid: () => crypto.randomUUID(), hextobin: (h) => parseInt(h, 16).toString(2),
            fetch: async (u) => await (await fetch(u)).json(), ping: () => navigator.onLine, settimeout: setTimeout, setinterval: setInterval, cleartimer: clearInterval, env: () => navigator.userAgent, platform: () => navigator.platform, version: () => "emc_lang v2.0", beep: () => printToTerminal("🔔 BEEP!"), copy: (t) => navigator.clipboard.writeText(t), prompt: (m) => prompt(m), rgbtohex: (r,g,b) => "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1), hextorgb: (h) => { let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null; }, range: (s, e) => Array.from({length: e - s + 1}, (_, i) => s + i), gcd: (a, b) => { while(b) { let t = b; b = a % b; a = t; } return Math.abs(a); }, lcm: (a, b) => Math.abs(a*b)/stdLib.gcd(a,b), isprime: (n) => { for(let i = 2, s = Math.sqrt(n); i <= s; i++) if(n % i === 0) return false; return n > 1; }, factorial: (n) => { let r=1; for(let i=2; i<=n; i++) r*=i; return r; }, radtodeg: (r) => r * (180/Math.PI), degtorad: (d) => d * (Math.PI/180)
        };

        // 4. Inyección Mágica en Sandbox (Funciones nativas sin "window.")
        const paramNames = Object.keys(stdLib);
        const paramValues = Object.values(stdLib);

        // Permitimos asignaciones sin var/let envolviendo en una función asíncrona no estricta
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        
        try {
            const runner = new AsyncFunction(...paramNames, processedCode);
            await runner(...paramValues);
        } catch (e) {
            // Re-lanzar error limpio para la consola
            throw new Error(`Sintaxis inválida o variable no definida cerca de: \n"${e.message}"`);
        }
    }
});
