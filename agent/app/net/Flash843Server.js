var net = require('net');
var log = require('pomelo-logger').getLogger("other", 'Flash843Server');

var ignore = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENETDOWN', 'EPIPE', 'ENOENT'];

//843server
var server843 = net.createServer(function(socket) {
	socket.setNoDelay(true);
	socket.on('error', function(err) {
		if (!~ignore.indexOf(err.code)) {
			log.error('843 socket error');
			log.error(err);
			socket.end();
			socket.destroy();
		}
	});
	socket.on("close", function() {
		socket.removeAllListeners();
		socket.destroy();
	});
	if (socket.onend == null) socket.end('<cross-domain-policy><allow-access-from domain="*" to-ports="*" /></cross-domain-policy>');
});

server843.on('error', function(err) {

});

exports.listen = function(port) {
	server843.listen(port);
};