// 获取页面上的显示屏和所有按钮
const display = document.getElementById("display");
const buttons = document.querySelectorAll(".button");

// 保存当前表达式。页面显示的内容也来自这个变量。
let expression = "";
let hasCalculated = false;

// 把内部运算符转换成更适合用户看的符号
function formatForDisplay(text) {
    let displayText = "";
    const gap = "\u200A";

    for (let i = 0; i < text.length; i = i + 1) {
        const char = text[i];
        const previousChar = text[i - 1];
        const minusIsNegativeSign = char === "-" && (i === 0 || isOperator(previousChar) || previousChar === "(");

        if (char === "*") {
            displayText = displayText + gap + "×" + gap;
        } else if (char === "/") {
            displayText = displayText + gap + "÷" + gap;
        } else if (char === "+") {
            displayText = displayText + gap + "+" + gap;
        } else if (char === "-" && !minusIsNegativeSign) {
            displayText = displayText + gap + "−" + gap;
        } else if (char === "-") {
            displayText = displayText + "−";
        } else {
            displayText = displayText + char;
        }
    }

    return displayText;
}

// 更新显示屏内容：没有输入时显示 0
function updateDisplay() {
    display.value = expression === "" ? "0" : formatForDisplay(expression);
}

// 判断一个字符是不是运算符
function isOperator(char) {
    return char === "+" || char === "-" || char === "*" || char === "/";
}

function isDigit(char) {
    return char >= "0" && char <= "9";
}

// 判断当前位置所在的数字里是否已经有小数点
function currentNumberHasDot() {
    let i = expression.length - 1;

    while (i >= 0 && !isOperator(expression[i]) && expression[i] !== "(" && expression[i] !== ")") {
        if (expression[i] === ".") {
            return true;
        }

        i = i - 1;
    }

    return false;
}

// 获取当前正在输入的数字，用来判断是否有没意义的前导 0
function getCurrentNumberText() {
    let i = expression.length - 1;
    let numberText = "";

    while (i >= 0 && !isOperator(expression[i]) && expression[i] !== "(" && expression[i] !== ")") {
        numberText = expression[i] + numberText;
        i = i - 1;
    }

    return numberText;
}

// 添加一个字符到表达式中，例如数字、运算符、小数点或括号
function addInput(value) {
    if (expression === "Error") {
        expression = "";
        hasCalculated = false;
    }

    if (hasCalculated) {
        if (isOperator(value)) {
            hasCalculated = false;
        } else if (isDigit(value) || value === "." || value === "(") {
            expression = "";
            hasCalculated = false;
        } else {
            hasCalculated = false;
            return;
        }
    }

    if (isDigit(value)) {
        const currentNumber = getCurrentNumberText();

        if (currentNumber === "0") {
            if (value === "0") {
                return;
            }

            expression = expression.slice(0, -1);
        }
    }

    if (value === ".") {
        if (currentNumberHasDot()) {
            return;
        }

        if (expression === "" || isOperator(expression[expression.length - 1]) || expression.endsWith("(")) {
            expression = expression + "0";
        }
    }

    if (isOperator(value) && expression !== "") {
        const lastChar = expression[expression.length - 1];

        if (isOperator(lastChar)) {
            expression = expression.slice(0, -1);
        }
    }

    expression = expression + value;
    hasCalculated = false;
    updateDisplay();
}

// 清空表达式，让计算器回到初始状态
function clearCalculator() {
    expression = "";
    hasCalculated = false;
    updateDisplay();
}

// 删除最后一个字符，实现 Backspace 功能
function backspace() {
    if (expression === "Error") {
        expression = "";
    } else {
        expression = expression.slice(0, -1);
    }

    hasCalculated = false;
    updateDisplay();
}

// 把表达式字符串拆成一个个 token，例如 "12+3" 会变成 [12, "+", 3]
function tokenize(text) {
    const tokens = [];
    let numberText = "";

    for (let i = 0; i < text.length; i = i + 1) {
        const char = text[i];

        if ((char >= "0" && char <= "9") || char === ".") {
            numberText = numberText + char;
        } else {
            if (numberText !== "") {
                tokens.push(Number(numberText));
                numberText = "";
            }

            tokens.push(char);
        }
    }

    if (numberText !== "") {
        tokens.push(Number(numberText));
    }

    return tokens;
}

// 计算 token 列表。这里使用简单的递归解析，支持括号和乘除优先级。
function evaluateTokens(tokens) {
    let position = 0;

    // 读取当前 token，但不移动位置
    function peek() {
        return tokens[position];
    }

    // 读取当前 token，并移动到下一个位置
    function next() {
        const token = tokens[position];
        position = position + 1;
        return token;
    }

    // 解析数字、括号和负数
    function parseFactor() {
        const token = next();

        if (typeof token === "number") {
            if (Number.isNaN(token)) {
                throw new Error("Invalid number");
            }

            return token;
        }

        if (token === "(") {
            const value = parseExpression();

            if (next() !== ")") {
                throw new Error("Missing closing bracket");
            }

            return value;
        }

        if (token === "-") {
            return -parseFactor();
        }

        throw new Error("Invalid expression");
    }

    // 先处理乘法和除法，因为它们优先级更高
    function parseTerm() {
        let value = parseFactor();

        while (peek() === "*" || peek() === "/") {
            const operator = next();
            const rightValue = parseFactor();

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

    // 最后处理加法和减法
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

// 执行等号计算：成功时显示结果，失败时显示 Error
function calculate() {
    try {
        if (expression === "") {
            return;
        }

        const tokens = tokenize(expression);
        const result = evaluateTokens(tokens);

        if (!Number.isFinite(result)) {
            throw new Error("Invalid result");
        }

        expression = String(Number(result.toFixed(10)));
        hasCalculated = true;
    } catch (error) {
        expression = "Error";
        hasCalculated = false;
    }

    updateDisplay();
}

// 处理鼠标点击按钮
function handleButtonClick(event) {
    const button = event.currentTarget;
    const value = button.dataset.value;
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

    if (action === "calculate") {
        calculate();
        return;
    }

    addInput(value);
}

// 处理键盘输入，让用户可以直接用键盘操作计算器
function handleKeyboardInput(event) {
    const key = event.key;

    if ((key >= "0" && key <= "9") || key === "." || key === "(" || key === ")") {
        playButtonAnimation(findButtonByValue(key));
        addInput(key);
        return;
    }

    if (key === "+" || key === "-" || key === "*" || key === "/") {
        event.preventDefault();
        playButtonAnimation(findButtonByValue(key));
        addInput(key);
        return;
    }

    if (key === "Enter" || key === "=") {
        event.preventDefault();
        playButtonAnimation(findButtonByAction("calculate"));
        calculate();
        return;
    }

    if (key === "Backspace") {
        playButtonAnimation(findButtonByAction("backspace"));
        backspace();
        return;
    }

    if (key === "Escape" || key.toLowerCase() === "c") {
        playButtonAnimation(findButtonByAction("clear"));
        clearCalculator();
    }
}

// 给每个按钮绑定点击事件
buttons.forEach(function (button) {
    button.addEventListener("click", handleButtonClick);
    button.addEventListener("animationend", function () {
        button.classList.remove("is-pressed");
    });
});

// 显示屏动画结束后移除状态类，方便下一次更新重新播放
// 播放按钮动效：一次点击只触发一次完整动画，连续点击同一个按钮也能重新播放
function playButtonAnimation(button) {
    if (!button || !button.classList) {
        return;
    }

    button.classList.remove("is-pressed");
    void button.offsetWidth;
    button.classList.add("is-pressed");
}

// 根据输入值找到对应按钮，例如 "7"、"+"、"("、"."
function findButtonByValue(value) {
    for (let i = 0; i < buttons.length; i = i + 1) {
        if (buttons[i].dataset.value === value) {
            return buttons[i];
        }
    }

    return null;
}

// 根据操作类型找到对应按钮，例如 clear、backspace、calculate
function findButtonByAction(action) {
    for (let i = 0; i < buttons.length; i = i + 1) {
        if (buttons[i].dataset.action === action) {
            return buttons[i];
        }
    }

    return null;
}

// 给整个页面绑定键盘事件
document.addEventListener("keydown", handleKeyboardInput);

// 页面加载完成后先显示 0
updateDisplay();
