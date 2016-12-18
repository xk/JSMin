/* jsmin.js para node.js
   2016-12-18
   Copyright (c) 2016 Jorge Chamorro Bieling (jorge@jorgechamorro.com)
   basado en:

jsmin.c
2008-08-03
Copyright (c) 2002 Douglas Crockford  (www.crockford.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

The Software shall be used for Good, not Evil.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

var theA;
var theB;
var stdin;
var EOF= "EOF";
var theLookahead = EOF;


/* puts -- write a string
                to a stream.
*/

function puts (stream, str) {
    process[stream].write(str);
}


/* isAlphanum -- return true if the character is a letter, digit, underscore,
        dollar sign, or non-ASCII character.
*/

function isAlphanum (c) {
    return ((c >= "a" && c <= "z") || (c >= "0" && c <= "9") ||
        (c >= "A" && c <= "Z") || c === "_" || c === "$" || c === "\\" ||
        c > "\x7e");
}


/* getc -- return the next character from stream,
        or EOF if there aren't any more.
*/

function getc (stream) {
    var c;
    if (stream.nextc < stream.buffer.length) {
        c = stream.buffer[stream.nextc];
        stream.nextc += 1;
        return c;
    }
    return EOF;
}


/* get -- return the next character from stdin. Watch out for lookahead. If
        the character is a control character, translate it to a space or
        linefeed.
*/

function get () {
    var c = theLookahead;
    theLookahead = EOF;
    if (c === EOF) {
        c = getc(stdin);
    }
    if (c === EOF || c >= " " || c === "\n") {
        return c;
    }
    if (c === "\r") {
        return "\n";
    }
    return " ";
}


/* peek -- get the next character without getting it.
*/

function peek () {
    theLookahead = get();
    return theLookahead;
}


/* next -- get the next character, excluding comments. peek() is used to see
        if a "/" is followed by a "/" or "*".
*/

function next () {
    var c = get();
    if  (c === "/") {
        switch (peek()) {
        case "/":
            for (;;) {
                c = get();
                if (c <= "\n") {
                    return c;
                }
            }
        case "*":
            get();
            for (;;) {
                switch (get()) {
                case "*":
                    if (peek() === "/") {
                        get();
                        return " ";
                    }
                    break;
                case EOF:
                    puts("stderr", "Error: JSMIN Unterminated comment.\n");
                    process.exit(1);
                }
            }
        default:
            return c;
        }
    }
    return c;
}


/* action -- do something! What you do is determined by the argument:
        1   Output A. Copy B to A. Get the next B.
        2   Copy B to A. Get the next B. (Delete A).
        3   Get the next B. (Delete B).
   action treats a string as a single character. Wow!
   action recognizes a regular expression if it is preceded by ( or , or =.
*/

function action (d) {
    switch (d) {
    case 1:
        puts("stdout", theA);
    case 2:
        theA = theB;
        if (theA === "'" || theA === "\"") {
            for (;;) {
                puts("stdout", theA);
                theA = get();
                if (theA === theB) {
                    break;
                }
                if (theA === "\\") {
                    puts("stdout", theA);
                    theA = get();
                }
                if (theA === EOF) {
                    puts("stderr", "Error: JSMIN unterminated string literal.");
                    process.exit(1);
                }
            }
        }
    case 3:
        theB = next();
        if (theB === "/" && (theA === "(" || theA === "," || theA === "=" ||
                             theA === ":" || theA === "[" || theA === "!" ||
                             theA === "&" || theA === "|" || theA === "?" ||
                             theA === "{" || theA === "}" || theA === ";" ||
                             theA === "\n")) {
            puts("stdout", theA);
            puts("stdout", theB);
            for (;;) {
                theA = get();
                if (theA === "/") {
                    break;
                }
                if (theA === "\\") {
                    puts("stdout", theA);
                    theA = get();
                }
                if (theA === EOF) {
                    puts("stderr", "Error: JSMIN unterminated Regular Expression literal.\n");
                    process.exit(1);
                }
                puts("stdout", theA);
            }
            theB = next();
        }
    }
}


/* jsmin -- Copy the input to the output, deleting the characters which are
        insignificant to JavaScript. Comments will be removed. Tabs will be
        replaced with spaces. Carriage returns will be replaced with linefeeds.
        Most spaces and linefeeds will be removed.
*/

function jsmin () {
    theA = "\n";
    action(3);
    while (theA !== EOF) {
        switch (theA) {
        case " ":
            if (isAlphanum(theB)) {
                action(1);
            } else {
                action(2);
            }
            break;
        case "\n":
            switch (theB) {
            case "{":
            case "[":
            case "(":
            case "+":
            case "-":
                action(1);
                break;
            case " ":
                action(3);
                break;
            default:
                if (isAlphanum(theB)) {
                    action(1);
                } else {
                    action(2);
                }
            }
            break;
        default:
            switch (theB) {
            case " ":
                if (isAlphanum(theA)) {
                    action(1);
                    break;
                }
                action(3);
                break;
            case "\n":
                switch (theA) {
                case "}":
                case "]":
                case ")":
                case "+":
                case "-":
                case "\"":
                case "'":
                    action(1);
                    break;
                default:
                    if (isAlphanum(theA)) {
                        action(1);
                    } else {
                        action(3);
                    }
                }
                break;
            default:
                action(1);
                break;
            }
        }
    }
}


/* main -- Output any command line arguments as comments
        and then minify the input.
*/
function main (argc, argv) {
    var i;
    for (i = 1; i < argc; i += 1) {
        process.stdout.write("// " + argv[i] + "\n");
    }
    stdin= {
        nextc:  0,
        buffer: new Buffer(0)
    };
    process.stdin.on("data", function (data) {
        stdin.buffer = Buffer.concat([stdin.buffer, data]);
    });
    process.stdin.on("end", function () {
        stdin.buffer = stdin.buffer.toString();
        jsmin();
    });
}


main(process.argc, process.argv);
