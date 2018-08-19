var hot = require("hotwork");
/**
 * @returns {UserManager} 
 */
exports.getUserManager = function() {
	return hot.get("UserManager", require(__dirname + "/UserManager"));
};
/**
 * @returns {GameConst} 
 */
exports.getGameConst = function() {
	return hot.get("GameConst", require(__dirname + "/../common/GameConst"));
};
/**
 * @returns {Cache} 
 */
exports.getCache = function() {
	return hot.get("Cache", require(__dirname + "/../common/Cache"));
};
/**
 * @returns {code} 
 */
exports.getCode = function() {
	return hot.get("code", require(__dirname + "/../common/code"));
};
/**
 * @returns {ApiPipe} 
 */
exports.getApiPipe = function() {
	return hot.get("ApiPipe", require(__dirname + "/PhpApiServer"));
};
/**
 * @returns {PhpApiServer} 
 */
exports.getPhpApiServer = function() {
	return hot.get("PhpApiServer", require(__dirname + "/PhpApiServer"));
};
/**
 * @returns {GameHubManager} 
 */
exports.getGameHubManager = function() {
	return hot.get("GameHubManager", require(__dirname + "/GameHubManager"));
};
/**
 * @returns {HubUserManager}
 */
exports.getHubUserManager=function(){
	return hot.get("HubUserManager", require(__dirname + "/gamehub/HubUserManager"));
}
/**
 * @returns {GameHubServer}
 */
exports.getGameHubServer=function(){
	return hot.get("GameHubServer", require(__dirname + "/gamehub/GameHubServer"));
}
/**
 * @returns {GameServerManager} 
 */
exports.getGameServerManager = function() {
	var gs = require(__dirname + "/GameServerManager");
	return hot.get("GameServerManager", require(__dirname + "/GameServerManager"));
};
/**
 * @returns {HubGameChannelManager}
 */
exports.getHubGameChannelManager = function() {
	return hot.get("HubGameChannelManager", require(__dirname + "/gamehub/HubGameChannel"), "HubGameChannelManager");
};
/**
 * @returns {HubGameChannel}
 */
exports.getHubGameChannel = function() {
	return hot.get("HubGameChannel", require(__dirname + "/gamehub/HubGameChannel"), "HubGameChannel");
};
/**
 * @returns {ChannelManager} 
 */
exports.getChannelManager = function() {
	return hot.get("ChannelManager", require(__dirname + "/ChannelManager"));
};
/**
 * @returns {Player}
 */
exports.getGamePlayer = function() {
	return hot.get("Player", require(__dirname + "/game/GamePlayer"));
};
/**
 * @returns {GameServer}
 */
exports.getGameServer = function() {
	return hot.get("GameServer", require(__dirname + "/game/GameServer"));
};
/**
 * @returns {GameChannelManager}
 */
exports.getGameChannelManager = function() {
	return hot.get("GameChannelManager", require(__dirname + "/game/PlayerToGameChannel"), "PlayerToGameChannel");
};
/**
 * @returns {PlayerToGameChannel}
 */
exports.getPlayerToGameChannel = function() {
	return hot.get("PlayerToGameChannel", require(__dirname + "/game/PlayerToGameChannel"), "PlayerToGameChannel");
};
/**
 * @returns {GameTable} 
 */
exports.getGameTable = function() {
	return hot.get("GameTable", require(__dirname + "/game/GameTable"));
};
/**
 * @returns {ProtoManager} 
 */
exports.getProtoManager = function() {
	return hot.get("ProtoManager", require(__dirname + "/ProtoManager"));
};
/**
 * @returns {DBManager} 
 */
exports.getDBManager = function() {
	return hot.get("DBManager", require(__dirname + "/DBManager"));
};
/**
 * @returns {ChatService} 
 */
exports.getChatService = function() {
	return hot.get("ChatService", require(__dirname + "/ChatService"));
};
/**
 * @returns {MahjongP2PService} 
 */
exports.getMahjongP2PService = function() {
	return hot.get("MahjongP2PService", require(__dirname + "/p2p/MahjongP2PService"));
};
/**
 * @returns {RandomAssignGameTable}
 */
exports.getRandomAssignGameTable = function() {
	return hot.get("RandomAssignGameTable", require(__dirname + "/p2p/RandomAssignGameTable"));
};
/**
 * @returns {TemporaryBadTable}
 */
exports.getTemporaryBadTable = function() {
	return hot.get("TemporaryBadTable", require(__dirname + "/p2p/TemporaryBadTable"));
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
exports.getGoldService = function() {
	return hot.get("GoldService", require(__dirname + "/p2p/GoldService"));
}
exports.getMatchHLServer = function() {
	return hot.get("MatchHLServer", require(__dirname + "/MatchHLServer"));
};