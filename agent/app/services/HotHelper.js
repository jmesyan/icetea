var hot = require("hotwork");
//UserManager
exports.getUserManager = function() {
	return hot.get("UserManager", require(__dirname + "/UserManager"));
};
//GameConst
exports.getGameConst = function() {
	return hot.get("GameConst", require(__dirname + "/../common/GameConst"));
};
//Cache
exports.getCache = function() {
	return hot.get("Cache", require(__dirname + "/../common/Cache"));
};
//code
exports.getCode = function() {
	return hot.get("code", require(__dirname + "/../common/code"));
};
//ApiPipe
exports.getApiPipe = function() {
	return hot.get("ApiPipe", require(__dirname + "/PhpApiServer"));
};
//PhpApiServer
exports.getPhpApiServer = function() {
	return hot.get("PhpApiServer", require(__dirname + "/PhpApiServer"));
};
//GameServerManager
exports.getGameServerManager = function() {
	var gs = require(__dirname + "/GameServerManager");
	return hot.get("GameServerManager", require(__dirname + "/GameServerManager"));
};
//ChannelManager
exports.getChannelManager = function() {
	return hot.get("ChannelManager", require(__dirname + "/ChannelManager"));
};
//Player
exports.getGamePlayer = function() {
	return hot.get("Player", require(__dirname + "/game/GamePlayer"));
};
//GameServer
exports.getGameServer = function() {
	return hot.get("GameServer", require(__dirname + "/game/GameServer"));
};
//GameServer
exports.getGameHandlers = function() {
	return hot.get("GameHandlers", require(__dirname + "/game/GameHandlers"));
};
//GameChannelManager
exports.getGameChannelManager = function() {
	return hot.get("GameChannelManager", require(__dirname + "/game/PlayerToGameChannel"), "PlayerToGameChannel");
};
//PlayerToGameChannel
exports.getPlayerToGameChannel = function() {
	return hot.get("PlayerToGameChannel", require(__dirname + "/game/PlayerToGameChannel"), "PlayerToGameChannel");
};
//GameTable
exports.getGameTable = function() {
	return hot.get("GameTable", require(__dirname + "/game/GameTable"));
};
//ProtoManager
exports.getProtoManager = function() {
	return hot.get("ProtoManager", require(__dirname + "/ProtoManager"));
};
//DBManager
exports.getDBManager = function() {
	return hot.get("DBManager", require(__dirname + "/DBManager"));
};
//ChatService
exports.getChatService = function() {
	return hot.get("ChatService", require(__dirname + "/ChatService"));
};
//MahjongP2PService
exports.getMahjongP2PService = function() {
	return hot.get("MahjongP2PService", require(__dirname + "/p2p/MahjongP2PService"));
};
exports.getTemporaryBadTable = function() {
	return hot.get("TemporaryBadTable", require(__dirname + "/p2p/TemporaryBadTable"));
};
exports.getRandomAssignGameTable = function() {
	return hot.get("RandomAssignGameTable", require(__dirname + "/p2p/RandomAssignGameTable"));
};

exports.getMatchServer = function() {
	return hot.get("MatchServer", require(__dirname + "/MatchServer"));
};
exports.getMatchCSServer = function() {
	return hot.get("MatchCSServer", require(__dirname + "/MatchCSServer"));
};
exports.getMatchCGServer = function() {
	return hot.get("MatchCGServer", require(__dirname + "/MatchCGServer"));
};
exports.getMatchYQServer = function() {
	return hot.get("MatchYQServer", require(__dirname + "/MatchYQServer"));
};
/**
 * @returns {GamePool}
 */
exports.getGamePool = function() {
    return hot.get("GamePool", require(__dirname + "/game/GamePool"));
};

exports.getGoldService = function() {
	return hot.get("GoldService", require(__dirname + "/p2p/GoldService"));
};
