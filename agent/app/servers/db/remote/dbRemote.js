var pomelo = require("pomelo");

module.exports = function(app) { return new Remote(app); };
var Remote = function(app) {};
var remote = Remote.prototype;

remote.addUserOnline = function(d, cb) {
	pomelo.app.get("dbManager").addUserOnline(d, cb);
};

remote.removeUserOnline = function(uid, cb) {
	pomelo.app.get("dbManager").removeUserOnline(uid, cb);
};

remote.removeUserOnlineByServer = function(gid, rtype, ridx, cb) {
	pomelo.app.get("dbManager").removeUserOnlineByServer(gid, rtype, ridx, cb);
};

remote.deleteUserOnline = function(uid, cb) {
	pomelo.app.get("dbManager").deleteUserOnline(uid, cb);
};

remote.updateUserOnlineTime = function(uid, start, cb) {
	pomelo.app.get("dbManager").updateUserOnlineTime(uid, start, cb);
};

remote.createUserRooms = function(obj, lid, cb) {
	pomelo.app.get("dbManager").createUserRooms(obj, lid, cb);
};

remote.removeRooms = function (gsid, cb) {
	pomelo.app.get("dbManager").removeRooms(gsid, cb);
};

remote.removeUserRoomByCode = function (code, cb) {
	pomelo.app.get("dbManager").removeUserRoomByCode(code, cb);
};
remote.removeUserRooms = function (code, state, cb) {
	pomelo.app.get("dbManager").removeUserRooms(code, state, cb);
};

remote.addRoomCards = function (uid, num, reasonno, reason, gameid, code, cb) {
	pomelo.app.get("dbManager").addRoomCards(uid, num, reasonno, reason, gameid, code, cb);
};

remote.addTickets = function (uid, num, reasonno, reason, gameid, cb) {
	pomelo.app.get("dbManager").addTickets(uid, num, reasonno, reason, gameid, cb);
};

remote.getUser = function (uid, cb) {
	pomelo.app.get("dbManager").getUser(uid, cb);
};
remote.getUserLiushui = function (ldate, uid, cb) {
	pomelo.app.get("dbManager").getUserLiushui(ldate, uid, cb);
};
remote.getGameConfig = function (id, cb) {
	pomelo.app.get("dbManager").getGameConfig(id, cb);
};
remote.getClub = function(uid,cb){
	pomelo.app.get("dbManager").getClub(uid, cb);
};

remote.getMatchConfig = function(cb) {
	pomelo.app.get('dbManager').getMatchConfig(cb);
};
remote.getUserMatchScore = function(mid, mlid, uid, cb){
	pomelo.app.get('dbManager').getUserMatchScore(mid, mlid, uid, cb);
};
//vip系统
remote.updateUser = function(uid, level, exps, cb){
	pomelo.app.get("dbManager").updateUser(uid, level, exps, cb);
};
remote.logUserLevel = function(uid, level, cb){
	pomelo.app.get("dbManager").logUserLevel(uid, level, cb);
};
remote.addUserProp = function(uid,pid, gstate, gtimelen, cb){
	pomelo.app.get("dbManager").addUserProp(uid, pid, gstate, gtimelen, cb);
};
remote.getGameLevel = function(cb){
	pomelo.app.get("dbManager").getGameLevel(cb);
};
remote.getUserProp = function(uid,pid,cb){
	pomelo.app.get('dbManager').getUserProp(uid,pid,cb);
};
remote.getUserProps = function(uid,cb){
	pomelo.app.get('dbManager').getUserProps(uid,cb);
};
remote.getGameProps = function(cb){
	pomelo.app.get('dbManager').getGameProps(cb);
};
remote.getVipConfig = function(cb){
	pomelo.app.get('dbManager').getVipConfig(cb);
};
remote.updateVip = function(uid,vip_level,vip_card,vip_day,cb){
	pomelo.app.get('dbManager').updateVip(uid,vip_level,vip_card,vip_day,cb);
};
remote.getGameEmojis = function(cb) {
	pomelo.app.get('dbManager').getGameEmojis(cb);
};
remote.getUserEmoji = function(uid, eid, cb) {
    pomelo.app.get('dbManager').getUserEmoji(uid, eid, cb);
};
remote.addUserEmoji = function(uid, eid, state, buy_state, gstate, gtimelen, cb){
    pomelo.app.get("dbManager").addUserEmoji(uid, eid, state, buy_state, gstate, gtimelen, cb);
};
remote.getUserEmojis = function(uid,cb){
    pomelo.app.get('dbManager').getUserEmojis(uid,cb);
};
remote.addUserRound = function(uid,cb){
	pomelo.app.get('dbManager').addUserRound(uid,cb);
};
remote.addCPStones = function(puid,cpid,type,num,uid,code,cb){
	pomelo.app.get('dbManager').addCPStones(puid,cpid,type,num,uid,code,cb);
}
remote.getCPMember = function(uid,cpid,cb){
	pomelo.app.get('dbManager').getCPMember(uid,cpid,cb);
}
remote.getClubMember = function(uid,cpid,cb){
	pomelo.app.get('dbManager').getClubMember(uid,cpid,cb);
}
remote.getCompartment = function(cpid,cb){
	pomelo.app.get('dbManager').getCompartment(cpid,cb);
}
remote.matchSign = function(uid, mid, mlid, cb) {
	pomelo.app.get("dbManager").matchSign(uid, mid, mlid, cb);
}
remote.updateMatchSign = function(uid,mid,mlid,state,cb){
	pomelo.app.get("dbManager").updateMatchSign(uid, mid, mlid, state, cb);
}
remote.getTestUser = function(cb){
	pomelo.app.get("dbManager").getTestUser(cb);
}
remote.getMatchSignTimes = function(uid,mid,cb){
	pomelo.app.get("dbManager").getMatchSignTimes(uid,mid,cb);
}
remote.matchmlid = function(mid,cb){
	pomelo.app.get("dbManager").matchmlid(mid,cb);
}
remote.getSignCSUser = function(mid,cb){
	pomelo.app.get('dbManager').getSignCSUser(mid,cb);
}
remote.getCSMatchSign = function(uid,mid,cb){
	pomelo.app.get('dbManager').getCSMatchSign(uid,mid,cb);
}
remote.updateCSMatchSign = function(uid,mid,cb){
	pomelo.app.get('dbManager').updateCSMatchSign(uid,mid,cb);
}
remote.getMotors = function(num,cb){
	pomelo.app.get('dbManager').getMotors(num,cb);
}
remote.updateMotor = function(uids,cb){
	pomelo.app.get('dbManager').updateMotor(uids,cb);
}
remote.removeMatchRooms = function (gsid, tid, cb) {
	pomelo.app.get("dbManager").removeMatchRooms(gsid, tid, cb);
};
remote.getRuningRoomByCode = function (code, cb) {
    pomelo.app.get("dbManager").getRuningRoomByCode(code, cb);
};
remote.getClubById = function(clubid, cb) {
	pomelo.app.get("dbManager").getClubById(clubid, cb);
}
//金币场
remote.addUserGolds = function(gid,uid,golds,reason,reasonno,cb){
	pomelo.app.get("dbManager").addUserGolds(gid,uid,golds,reason,reasonno,cb);
}
remote.createGoldRooms = function(obj, cb) {
    pomelo.app.get("dbManager").createGoldRooms(obj, cb);
}
remote.goldsDropLog = function(uid,redpack,gid,rtype,ridx,state,cb){
	pomelo.app.get("dbManager").goldsDropLog(uid,redpack,gid,rtype,ridx,state,cb);
}
remote.removeGoldRooms = function (lid, state, cb) {
    pomelo.app.get("dbManager").removeGoldRooms(lid, state, cb);
};

remote.getActivityConfig = function (acid, cb) {
	pomelo.app.get("dbManager").getActivityConfig(acid, cb);
}

remote.matchYQRank = function(mid,date,cb){
	pomelo.app.get('dbManager').matchYQRank(mid,date, cb);
}

remote.getYQSign = function(uid,mid,date,cb){
	pomelo.app.get('dbManager').getYQSign(uid,mid,date,cb);
}