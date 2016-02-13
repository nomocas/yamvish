var repl = require("repl");

y = require('./index');

require('./lib/output-engine/string');
require('./lib/output-engine/twopass');

var replServer = repl.start({
	prompt: "yam-repl > ",
});
