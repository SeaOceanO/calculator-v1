// V4：MathLive 负责自然数学输入和排版；本文件负责按钮、历史记录和安全计算。
const mathDisplay = document.getElementById("mathDisplay");
const buttons = document.querySelectorAll(".button");
const calculator = document.querySelector(".calculator");
const angleModeButton = document.getElementById("angleModeButton");
const historyList = document.getElementById("historyList");
const modeButtons = document.querySelectorAll(".mode-button");
const statusMessage = document.getElementById("statusMessage");

let hasCalculated = true;
let lastAnswer = 0;
let decimalResult = null;
let fractionResult = null;
let resultDisplayMode = "decimal";
let angleMode = "DEG";
let historyItems = [];
let isSettingLatex = false;

// Node 测试环境没有 MathLive，fallbackLatex 只用于自动测试。
let fallbackLatex = "0";

function mathfieldReady() {
    return mathDisplay && typeof mathDisplay.getValue === "function" && typeof mathDisplay.setValue === "function";
}

// V4：禁用 MathLive 自带虚拟键盘，手机端只使用页面里的计算器按钮。
function hideMathVirtualKeyboard() {
    if (typeof window !== "undefined" && window.mathVirtualKeyboard) {
        window.mathVirtualKeyboard.hide();
    }
}

function configureMathDisplayKeyboard() {
    if (!mathDisplay) {
        return;
    }

    if (typeof mathDisplay.setAttribute === "function") {
        mathDisplay.setAttribute("math-virtual-keyboard-policy", "manual");
        mathDisplay.setAttribute("inputmode", "none");
    }

    mathDisplay.mathVirtualKeyboardPolicy = "manual";
    hideMathVirtualKeyboard();
}

function getLatex() {
    if (mathfieldReady()) {
        return mathDisplay.value || mathDisplay.getValue() || "";
    }

    return fallbackLatex;
}

function setLatex(latex) {
    const value = latex || "";

    isSettingLatex = true;

    try {
        if (mathfieldReady()) {
            mathDisplay.setValue(value, { silenceNotifications: true });
            mathDisplay.value = value;
            mathDisplay.executeCommand("moveToMathfieldEnd");
        } else {
            fallbackLatex = value;
        }
    } finally {
        isSettingLatex = false;
    }
}

function clearStatus() {
    if (statusMessage) {
        statusMessage.textContent = "";
    }

    if (mathDisplay && mathDisplay.classList) {
        mathDisplay.classList.remove("is-invalid");
    }
}

function showInvalid(message) {
    if (statusMessage) {
        statusMessage.textContent = message || "Invalid expression";
    }

    if (mathDisplay && mathDisplay.classList) {
        mathDisplay.classList.remove("is-invalid");
        void mathDisplay.offsetWidth;
        mathDisplay.classList.add("is-invalid");
    }
}

function showStatus(message) {
    if (statusMessage) {
        statusMessage.textContent = message || "";
    }

    if (mathDisplay && mathDisplay.classList) {
        mathDisplay.classList.remove("is-invalid");
    }
}

function hasInvalidStatus() {
    return Boolean(mathDisplay && mathDisplay.classList && mathDisplay.classList.contains("is-invalid"));
}

// S⇔D：清掉上一次结果的两种显示形式，避免新输入时误切换旧结果。
function resetResultState() {
    decimalResult = null;
    fractionResult = null;
    resultDisplayMode = "decimal";
}

function isOperatorToken(token) {
    return token === "+" || token === "-" || token === "*" || token === "/" || token === "^";
}

function isDigit(char) {
    return char >= "0" && char <= "9";
}

// V4：点击按钮时插入 LaTeX。MathLive 的 #0/#@/#? 会处理选区和占位符。
function insertMath(latex, options) {
    if (!latex) {
        return;
    }

    const shouldKeepResult = options && options.keepResult;

    if (hasCalculated && !shouldKeepResult) {
        setLatex("");
    }

    hasCalculated = false;
    resetResultState();
    clearStatus();

    if (mathfieldReady() && typeof mathDisplay.executeCommand === "function") {
        mathDisplay.focus();
        mathDisplay.executeCommand([
            "insert",
            latex,
            {
                focus: true,
                insertionMode: "replaceSelection",
                selectionMode: "placeholder",
                scrollIntoView: true
            }
        ]);
    } else {
        fallbackLatex = fallbackLatex === "0" && !shouldKeepResult ? latex : fallbackLatex + latex;
    }
}

function valueToLatex(value) {
    // V4：给二元运算符加轻微负间距，让自然显示里的符号间隔更接近普通计算器观感。
    const tightSpace = "\\!";

    function compactOperator(operatorLatex) {
        return tightSpace + operatorLatex + tightSpace;
    }

    if (value === "+") {
        return compactOperator("+");
    }

    if (value === "-") {
        return compactOperator("-");
    }

    if (value === "*") {
        return compactOperator("\\times");
    }

    if (value === "/") {
        return compactOperator("\\div");
    }

    if (value === "%") {
        return "\\%";
    }

    return value;
}

function valueKeepsResult(value, latex) {
    return value === "+" || value === "-" || value === "*" || value === "/" || value === "%" || value === "!" || latex === "#@^{2}" || latex === "#@^{#?}";
}

function clearCalculator() {
    setLatex("0");
    hasCalculated = true;
    resetResultState();
    clearStatus();
}

function backspace() {
    clearStatus();
    hasCalculated = false;
    resetResultState();

    if (mathfieldReady() && typeof mathDisplay.executeCommand === "function") {
        mathDisplay.focus();
        mathDisplay.executeCommand("deleteBackward");
    } else {
        fallbackLatex = fallbackLatex.slice(0, -1) || "0";
    }
}

function moveCursor(action) {
    const commandMap = {
        "move-left": "moveToPreviousChar",
        "move-right": "moveToNextChar",
        "move-up": "moveUp",
        "move-down": "moveDown"
    };

    if (!mathfieldReady() || typeof mathDisplay.executeCommand !== "function") {
        return;
    }

    mathDisplay.focus();
    const moved = mathDisplay.executeCommand(commandMap[action]);

    // 右方向键如果在分母、根号或上标末尾，尽量跳出父级结构。
    if (!moved && action === "move-right") {
        mathDisplay.executeCommand("moveAfterParent");
    }
}

// V4 第一阶段：+/- 作为轻量输入，避免破坏 MathLive 当前结构。
function toggleSign() {
    insertMath("-", { keepResult: false });
}

function setMode(mode) {
    const useScientific = mode === "scientific";

    if (calculator) {
        calculator.classList.toggle("is-scientific", useScientific);
    }

    modeButtons.forEach(function (button) {
        button.classList.toggle("is-active", button.dataset.mode === mode);
    });
}

function toggleAngleMode() {
    angleMode = angleMode === "DEG" ? "RAD" : "DEG";

    if (angleModeButton) {
        angleModeButton.textContent = angleMode;
    }
}

function readGroup(text, startIndex) {
    let i = startIndex;

    while (text[i] === " ") {
        i = i + 1;
    }

    if (text[i] !== "{") {
        throw new Error("Expected group");
    }

    let depth = 0;
    let content = "";

    for (; i < text.length; i = i + 1) {
        const char = text[i];

        if (char === "{") {
            if (depth > 0) {
                content = content + char;
            }

            depth = depth + 1;
        } else if (char === "}") {
            depth = depth - 1;

            if (depth === 0) {
                return {
                    content: content,
                    nextIndex: i + 1
                };
            }

            content = content + char;
        } else {
            content = content + char;
        }
    }

    throw new Error("Unclosed group");
}

function readLatexArgument(text, startIndex) {
    let i = startIndex;

    while (text[i] === " ") {
        i = i + 1;
    }

    if (text[i] === "{") {
        return readGroup(text, i);
    }

    if (!text[i]) {
        throw new Error("Expected argument");
    }

    if (text[i] === "\\") {
        const commandMatch = text.slice(i).match(/^\\[a-zA-Z]+/);

        if (commandMatch) {
            return {
                content: commandMatch[0],
                nextIndex: i + commandMatch[0].length
            };
        }
    }

    return {
        content: text[i],
        nextIndex: i + 1
    };
}

function normalizeLatex(latex) {
    return latex
        .replaceAll("\u2062", "*")
        .replaceAll("\u00D7", "*")
        .replaceAll("\u00F7", "/")
        .replaceAll("\u2212", "-")
        .replaceAll("\u00A0", "")
        .replaceAll("\\left", "")
        .replaceAll("\\right", "")
        .replaceAll("\\mleft", "")
        .replaceAll("\\mright", "")
        .replaceAll("\\,", "")
        .replaceAll("\\;", "")
        .replaceAll("\\:", "")
        .replaceAll("\\quad", "")
        .replaceAll("\\qquad", "")
        .replaceAll("\\!", "")
        .replaceAll("\\ ", "")
        .replace(/\\mspace\{[^}]*\}/g, "")
        .replace(/\\kern\{[^}]*\}/g, "")
        .replace(/[\u2000-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, "")
        .replace(/\{\}/g, "");
}

// V4：把 MathLive 的 LaTeX 转成现有安全解析器可以处理的内部表达式。
function latexToExpression(latex) {
    const text = normalizeLatex(latex || "");

    if (text.includes("\\placeholder") || text.includes("#")) {
        throw new Error("Incomplete expression");
    }

    return insertImplicitMultiplication(parseLatexSegment(text));
}

// V4：自然书写里常见的相邻表达式自动视为乘法，例如 7\frac{8}{8}、2π、2(3+4)、3√9。
function insertImplicitMultiplication(text) {
    let result = "";

    for (let i = 0; i < text.length; i = i + 1) {
        const previous = result[result.length - 1];
        const current = text[i];

        if (shouldInsertMultiplication(previous, current)) {
            result = result + "*";
        }

        result = result + current;
    }

    return result;
}

function shouldInsertMultiplication(previous, current) {
    if (!previous || !current) {
        return false;
    }

    const previousIsNumberPart = isDigit(previous) || previous === ".";
    const previousIsCompleteValue = previous === ")" || previous === "π" || previous === "e" || previous === "%" || previous === "!" || previous === "²";
    const currentIsNumberPart = isDigit(current) || current === ".";
    const currentIsNonNumberValue = current === "(" || current === "π" || current === "e" || current === "√";

    if (previousIsNumberPart && currentIsNumberPart) {
        return false;
    }

    return (previousIsNumberPart && currentIsNonNumberValue) || (previousIsCompleteValue && (currentIsNumberPart || currentIsNonNumberValue));
}

function parseLatexSegment(text) {
    let result = "";

    function appendValue(valueText) {
        const previous = result[result.length - 1];
        const current = valueText[0];

        if (shouldInsertMultiplication(previous, current)) {
            result = result + "*";
        }

        result = result + valueText;
    }

    for (let i = 0; i < text.length; i = i + 1) {
        const char = text[i];

        if (char === " " || char === "\n" || char === "\t") {
            continue;
        }

        if (text.startsWith("\\frac", i) || text.startsWith("\\dfrac", i) || text.startsWith("\\tfrac", i)) {
            const commandLength = text.startsWith("\\frac", i) ? 5 : 6;
            const numerator = readLatexArgument(text, i + commandLength);
            const denominator = readLatexArgument(text, numerator.nextIndex);

            appendValue("(" + parseLatexSegment(numerator.content) + ")/(" + parseLatexSegment(denominator.content) + ")");
            i = denominator.nextIndex - 1;
            continue;
        }

        if (text.startsWith("\\sqrt", i)) {
            const radicand = readLatexArgument(text, i + 5);

            appendValue("√(" + parseLatexSegment(radicand.content) + ")");
            i = radicand.nextIndex - 1;
            continue;
        }

        if (text.startsWith("\\operatorname", i)) {
            const group = readGroup(text, i + 13);

            result = result + group.content;
            i = group.nextIndex - 1;
            continue;
        }

        if (text.startsWith("\\mathrm", i)) {
            const group = readGroup(text, i + 7);

            result = result + group.content;
            i = group.nextIndex - 1;
            continue;
        }

        if (text.startsWith("\\sin", i) || text.startsWith("\\cos", i) || text.startsWith("\\tan", i) || text.startsWith("\\log", i)) {
            appendValue(text.slice(i + 1, i + 4));
            i = i + 3;
            continue;
        }

        if (text.startsWith("\\ln", i)) {
            appendValue("ln");
            i = i + 2;
            continue;
        }

        if (text.startsWith("\\pi", i)) {
            appendValue("π");
            i = i + 2;
            continue;
        }

        if (text.startsWith("\\times", i) || text.startsWith("\\cdot", i)) {
            result = result + "*";
            i = i + 5;
            continue;
        }

        if (text.startsWith("\\div", i)) {
            result = result + "/";
            i = i + 3;
            continue;
        }

        if (text.startsWith("\\%", i)) {
            result = result + "%";
            i = i + 1;
            continue;
        }

        if (char === "^") {
            const exponent = readLatexArgument(text, i + 1);

            result = result + "^(" + parseLatexSegment(exponent.content) + ")";
            i = exponent.nextIndex - 1;

            continue;
        }

        if (char === "{") {
            const group = readGroup(text, i);

            if (group.content.trim() !== "") {
                appendValue("(" + parseLatexSegment(group.content) + ")");
            }

            i = group.nextIndex - 1;
            continue;
        }

        if (char === "×") {
            result = result + "*";
        } else if (char === "÷") {
            result = result + "/";
        } else if (char === "−") {
            result = result + "-";
        } else if (isDigit(char) || char === "." || char === "(" || char === "π" || char === "e" || char === "√") {
            appendValue(char);
        } else {
            result = result + char;
        }
    }

    return result;
}

function canEndValue(token) {
    return typeof token === "number" || token === ")" || token === "π" || token === "e" || token === "Ans" || token === "²" || token === "%" || token === "!";
}

function canStartValue(token) {
    return typeof token === "number" || token === "(" || token === "π" || token === "e" || token === "Ans" || token === "√" || token === "sin" || token === "cos" || token === "tan" || token === "log" || token === "ln" || token === "inv";
}

function tokenize(text) {
    const tokens = [];
    let numberText = "";
    const wordTokens = ["Ans", "sin", "cos", "tan", "log", "ln", "inv"];

    function pushToken(token) {
        const previous = tokens[tokens.length - 1];

        if (canEndValue(previous) && canStartValue(token)) {
            tokens.push("*");
        }

        tokens.push(token);
    }

    function pushNumber() {
        if (numberText !== "") {
            pushToken(Number(numberText));
            numberText = "";
        }
    }

    for (let i = 0; i < text.length; i = i + 1) {
        const char = text[i];
        let matchedWord = "";

        if (isDigit(char) || char === ".") {
            numberText = numberText + char;
            continue;
        }

        pushNumber();

        for (let j = 0; j < wordTokens.length; j = j + 1) {
            if (text.startsWith(wordTokens[j], i)) {
                matchedWord = wordTokens[j];
                break;
            }
        }

        if (matchedWord !== "") {
            pushToken(matchedWord);
            i = i + matchedWord.length - 1;
        } else {
            pushToken(char);
        }
    }

    pushNumber();

    return tokens;
}

function toRadians(value) {
    return angleMode === "DEG" ? value * Math.PI / 180 : value;
}

function applyFunction(name, value) {
    if (name === "sin") {
        return Math.sin(toRadians(value));
    }

    if (name === "cos") {
        return Math.cos(toRadians(value));
    }

    if (name === "tan") {
        const radians = toRadians(value);

        if (Math.abs(Math.cos(radians)) < 1e-12) {
            throw new Error("Undefined tangent");
        }

        return Math.tan(radians);
    }

    if (name === "log") {
        if (value <= 0) {
            throw new Error("Invalid log");
        }

        return Math.log10(value);
    }

    if (name === "ln") {
        if (value <= 0) {
            throw new Error("Invalid ln");
        }

        return Math.log(value);
    }

    if (name === "inv") {
        if (value === 0) {
            throw new Error("Divide by zero");
        }

        return 1 / value;
    }

    throw new Error("Unknown function");
}

function factorial(value) {
    if (!Number.isInteger(value) || value < 0 || value > 170) {
        throw new Error("Invalid factorial");
    }

    let result = 1;

    for (let i = 2; i <= value; i = i + 1) {
        result = result * i;
    }

    return result;
}

function evaluateTokens(tokens) {
    let position = 0;

    function peek() {
        return tokens[position];
    }

    function next() {
        const token = tokens[position];
        position = position + 1;
        return token;
    }

    function parsePrimary() {
        const token = next();

        if (typeof token === "number") {
            if (Number.isNaN(token)) {
                throw new Error("Invalid number");
            }

            return token;
        }

        if (token === "π") {
            return Math.PI;
        }

        if (token === "e") {
            return Math.E;
        }

        if (token === "Ans") {
            return lastAnswer;
        }

        if (token === "sin" || token === "cos" || token === "tan" || token === "log" || token === "ln" || token === "inv") {
            return applyFunction(token, parseUnary());
        }

        if (token === "(") {
            const value = parseExpression();

            if (next() !== ")") {
                throw new Error("Missing closing bracket");
            }

            return value;
        }

        throw new Error("Invalid expression");
    }

    function parsePostfix() {
        let value = parsePrimary();

        while (peek() === "²" || peek() === "%" || peek() === "!") {
            const operator = next();

            if (operator === "²") {
                value = value * value;
            } else if (operator === "%") {
                value = value / 100;
            } else {
                value = factorial(value);
            }
        }

        return value;
    }

    function parseUnary() {
        const token = peek();

        if (token === "+") {
            next();
            return parseUnary();
        }

        if (token === "-") {
            next();
            return -parseUnary();
        }

        if (token === "√") {
            next();
            const value = parseUnary();

            if (value < 0) {
                throw new Error("Square root of negative number");
            }

            return Math.sqrt(value);
        }

        return parsePostfix();
    }

    function parsePower() {
        let value = parseUnary();

        if (peek() === "^") {
            next();
            value = Math.pow(value, parsePower());
        }

        return value;
    }

    function parseTerm() {
        let value = parsePower();

        while (peek() === "*" || peek() === "/") {
            const operator = next();
            const rightValue = parsePower();

            if (operator === "*") {
                value = value * rightValue;
            } else {
                if (rightValue === 0) {
                    throw new Error("Divide by zero");
                }

                value = value / rightValue;
            }
        }

        return value;
    }

    function parseExpression() {
        let value = parseTerm();

        while (peek() === "+" || peek() === "-") {
            const operator = next();
            const rightValue = parseTerm();

            if (operator === "+") {
                value = value + rightValue;
            } else {
                value = value - rightValue;
            }
        }

        return value;
    }

    const result = parseExpression();

    if (position !== tokens.length) {
        throw new Error("Extra token");
    }

    return result;
}

function formatResultNumber(value) {
    if (!Number.isFinite(value)) {
        throw new Error("Invalid result");
    }

    const rounded = Number(value.toFixed(10));

    if (Object.is(rounded, -0)) {
        return "0";
    }

    return String(rounded);
}

function gcd(a, b) {
    let left = Math.abs(a);
    let right = Math.abs(b);

    while (right !== 0) {
        const remainder = left % right;

        left = right;
        right = remainder;
    }

    return left || 1;
}

// S⇔D：把小数安全转换成较小分母的分数，避免 3.14159 被乱转成巨大分数。
function decimalToFraction(value, maxDenominator) {
    const limit = maxDenominator || 1000;
    const tolerance = 1e-9;
    const normalizedValue = Number(Number(value).toPrecision(12));

    if (!Number.isFinite(normalizedValue) || Math.abs(normalizedValue) > 1000000000) {
        return null;
    }

    const sign = normalizedValue < 0 ? -1 : 1;
    const absoluteValue = Math.abs(normalizedValue);
    let bestNumerator = Math.round(absoluteValue);
    let bestDenominator = 1;
    let bestError = Math.abs(absoluteValue - bestNumerator);

    for (let denominator = 1; denominator <= limit; denominator = denominator + 1) {
        const numerator = Math.round(absoluteValue * denominator);
        const approximation = numerator / denominator;
        const error = Math.abs(absoluteValue - approximation);

        if (error < bestError) {
            bestNumerator = numerator;
            bestDenominator = denominator;
            bestError = error;
        }
    }

    if (bestError > tolerance) {
        return null;
    }

    const divisor = gcd(bestNumerator, bestDenominator);

    return {
        numerator: sign * (bestNumerator / divisor),
        denominator: bestDenominator / divisor
    };
}

function fractionToLatex(fraction) {
    if (!fraction) {
        return "";
    }

    if (fraction.denominator === 1) {
        return String(fraction.numerator);
    }

    if (fraction.numerator < 0) {
        return "-\\frac{" + Math.abs(fraction.numerator) + "}{" + fraction.denominator + "}";
    }

    return "\\frac{" + fraction.numerator + "}{" + fraction.denominator + "}";
}

function fractionToText(fraction) {
    if (!fraction) {
        return "";
    }

    if (fraction.denominator === 1) {
        return String(fraction.numerator);
    }

    return fraction.numerator + "/" + fraction.denominator;
}

function expressionCanBecomeFraction(rawLatex) {
    const expressionText = latexToExpression(rawLatex);

    return !expressionText.includes("π")
        && !expressionText.includes("e")
        && !expressionText.includes("√")
        && !expressionText.includes("sin")
        && !expressionText.includes("cos")
        && !expressionText.includes("tan")
        && !expressionText.includes("log")
        && !expressionText.includes("ln")
        && !expressionText.includes("Ans")
        && !expressionText.includes("inv");
}

function buildFractionResult(rawLatex, resultText) {
    if (!expressionCanBecomeFraction(rawLatex)) {
        return null;
    }

    const fraction = decimalToFraction(Number(resultText), 1000);

    if (!fraction) {
        return null;
    }

    return {
        numerator: fraction.numerator,
        denominator: fraction.denominator,
        latex: fractionToLatex(fraction),
        text: fractionToText(fraction)
    };
}

function calculateLatex(latex) {
    const expressionText = latexToExpression(latex);
    const tokens = tokenize(expressionText);
    const result = evaluateTokens(tokens);

    return formatResultNumber(result);
}

function renderHistory() {
    if (!historyList || !document.createElement) {
        return;
    }

    historyList.textContent = "";
    historyList.classList.toggle("is-empty", historyItems.length === 0);

    historyItems.forEach(function (item) {
        const row = document.createElement("div");
        const expressionText = document.createElement("span");
        const resultText = document.createElement("strong");

        row.className = "history-item";
        expressionText.className = "history-expression";
        resultText.className = "history-result";

        expressionText.textContent = item.expression;
        resultText.textContent = item.result;

        row.appendChild(expressionText);
        row.appendChild(resultText);
        historyList.appendChild(row);
    });
}

function addHistoryItem(rawLatex, resultText, currentFractionResult) {
    historyItems.unshift({
        expression: latexToExpression(rawLatex),
        decimalResult: resultText,
        fractionResult: currentFractionResult ? currentFractionResult.text : "",
        result: resultText
    });

    historyItems = historyItems.slice(0, 2);
    renderHistory();
}

function syncLatestHistoryResult() {
    if (historyItems.length === 0) {
        return;
    }

    if (resultDisplayMode === "fraction" && fractionResult) {
        historyItems[0].result = fractionResult.text;
    } else if (decimalResult !== null) {
        historyItems[0].result = decimalResult;
    }

    renderHistory();
}

// S⇔D：只切换“已计算结果”的显示形式，不重新计算，也不改用户原来的表达式记录。
function toggleResultDisplay() {
    if (!hasCalculated || decimalResult === null || hasInvalidStatus()) {
        return;
    }

    if (!fractionResult) {
        showStatus("Cannot convert exactly");
        return;
    }

    if (resultDisplayMode === "decimal") {
        setLatex(fractionResult.latex);
        resultDisplayMode = "fraction";
    } else {
        setLatex(decimalResult);
        resultDisplayMode = "decimal";
    }

    hasCalculated = true;
    clearStatus();
    syncLatestHistoryResult();
}

function calculate() {
    const rawLatex = getLatex();

    try {
        if (rawLatex.trim() === "") {
            return;
        }

        const resultText = calculateLatex(rawLatex);
        const currentFractionResult = buildFractionResult(rawLatex, resultText);

        lastAnswer = Number(resultText);
        decimalResult = resultText;
        fractionResult = currentFractionResult;
        resultDisplayMode = "decimal";
        setLatex(resultText);
        hasCalculated = true;
        clearStatus();
        addHistoryItem(rawLatex, resultText, currentFractionResult);
    } catch (error) {
        resetResultState();
        console.warn("Calculation failed", {
            latex: rawLatex,
            normalized: normalizeLatex(rawLatex),
            message: error.message
        });
        showInvalid("Invalid expression");
    }
}

function handleButtonClick(event) {
    const button = event.currentTarget;
    const value = button.dataset.value;
    const latex = button.dataset.latex;
    const action = button.dataset.action;

    playButtonAnimation(button);

    if (action === "clear") {
        clearCalculator();
        return;
    }

    if (action === "backspace") {
        backspace();
        return;
    }

    if (action === "toggle-sign") {
        toggleSign();
        return;
    }

    if (action === "set-mode") {
        setMode(button.dataset.mode);
        return;
    }

    if (action === "toggle-angle") {
        toggleAngleMode();
        return;
    }

    if (action === "toggle-result-display") {
        toggleResultDisplay();
        return;
    }

    if (action === "calculate") {
        calculate();
        return;
    }

    if (action && action.startsWith("move-")) {
        moveCursor(action);
        return;
    }

    insertMath(latex || valueToLatex(value), {
        keepResult: valueKeepsResult(value, latex)
    });
}

function handleKeyboardInput(event) {
    if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        playButtonAnimation(findButtonByAction("calculate"));
        calculate();
        return;
    }

    if (event.key === "Escape") {
        playButtonAnimation(findButtonByAction("clear"));
        clearCalculator();
    }
}

buttons.forEach(function (button) {
    button.addEventListener("click", handleButtonClick);
    button.addEventListener("animationend", function () {
        button.classList.remove("is-pressed");
    });
});

function playButtonAnimation(button) {
    if (!button || !button.classList) {
        return;
    }

    button.classList.remove("is-pressed");
    void button.offsetWidth;
    button.classList.add("is-pressed");
}

function findButtonByAction(action) {
    for (let i = 0; i < buttons.length; i = i + 1) {
        if (buttons[i].dataset.action === action) {
            return buttons[i];
        }
    }

    return null;
}

document.addEventListener("keydown", handleKeyboardInput);

if (mathDisplay) {
    configureMathDisplayKeyboard();

    mathDisplay.addEventListener("focus", hideMathVirtualKeyboard);
    mathDisplay.addEventListener("click", hideMathVirtualKeyboard);
    mathDisplay.addEventListener("pointerdown", hideMathVirtualKeyboard);
    mathDisplay.addEventListener("touchstart", hideMathVirtualKeyboard, { passive: true });

    mathDisplay.addEventListener("input", function () {
        if (isSettingLatex) {
            return;
        }

        hasCalculated = false;
        resetResultState();
        clearStatus();
        hideMathVirtualKeyboard();
    });

    mathDisplay.addEventListener("beforeinput", function (event) {
        if (event.inputType === "insertLineBreak") {
            event.preventDefault();
            calculate();
        }
    });
}

setMode("scientific");
renderHistory();
setLatex("0");
hideMathVirtualKeyboard();
