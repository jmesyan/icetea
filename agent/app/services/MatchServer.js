var log = require('pomelo-logger').getLogger("hall", "MatchServer");
var pomelo = require("pomelo");
var hothelper = require("./HotHelper");
var code = hothelper.getCode();
var pushCmd = require("../common/GameConst").pushCmd;
var tools = require("../GameUtils/Tools");
var randomAssignGameTable = hothelper.getRandomAssignGameTable();
var gsManager = hothelper.getGameServerManager();
var userManager = hothelper.getUserManager();
var temporaryBadTable = hothelper.getTemporaryBadTable();
var GameConst = hothelper.getGameConst();
var sys = require("./StoreDatas").sys;
var bs = require("./StoreDatas").bs;
var p2p = require("./StoreDatas").p2p;

var MatchServer = function() { };
var server = MatchServer.prototype;

server.init = function(){
	if(pomelo.app.getServerType()!="hall")return;
	if (!bs.ms) bs.ms = {}; //存所有比赛信息
	if (!bs.gs) bs.gs = {}; //存所有比赛gid=>mid
	if (!bs.ss) bs.ss = {}; //存比赛状态0未开始 1开始 2结束
	if (!bs.es) bs.es = {}; //存比赛进入用户 1进入排队 2开始进入游戏 3成功进入游戏
	if (!bs.cs) bs.cs = {}; //存比赛code=>mid
	if (!bs.ur) bs.ur = {}; //存比赛用户当前局数
};
server.getMatch = function(me, session, body, next) {
	var mid = bs.cs[body.code];
	if (!mid || !bs.ms[mid]) return next(null, {code: code.FAIL, msg: '暂无比赛！'});
	var m = bs.ms[mid], time = tools.getSystemSecond(),
		curr = (bs.ur[mid] && bs.ur[mid][session.uid] ? bs.ur[mid][session.uid] : 0) + 1;
	if (body.exit) {
		delete bs.es[m.mid][session.uid];
		return next(null, {code: code.OK});
	}
	if (bs.ss[m.mid] == 0)
		next(null, {code: code.FAIL, msg: '比赛未开始！', match: m, state: 0, time: time, curr: curr });
	else if (bs.ss[m.mid] == 2)
		next(null, {code: code.FAIL, msg: '比赛已经结束！', match: m, state: 2, time: time, curr: curr });
	else {
		next(null, {code: code.OK, match: m, state: 1, time: time, curr: curr });
	}
};
server.removeMatchUser = function (uid) {
	var self = this;
	for (var mid in bs.ms) if (bs.es[mid][uid] == 1){
		var m = bs.ms[mid];
		if(!m) {delete bs.es[mid][uid]; console.log("!match",mid,uid);continue;}
		self.matchYQUnsign(uid,mid,m);
	}
};

server.matchYQUnsign = function(uid,mid,m){
	var self = this;
	var matchUnsignCallback = function(body){
		console.log('matchUnsignRemovesortCallback',JSON.stringify(body));
		if (body.rel == 0) {
			var player = userManager.getOnlineUserSort(uid);
			if (player) delete player.mid;
			delete bs.es[mid][uid];
			self.removeUser(uid,player.reload?false:true);
		}
	}

	if(m.gsid) var server = gsManager.getServerByGSID(m.gsid);
	if (!!server) server.sendString('03USIN{0}|{1}|{2}|{3}'.format(gsManager.getTick(matchUnsignCallback), mid, uid, 0));
}

//通知比赛状态
server.noticeMatch = function(body) {
	console.log('比赛通知',JSON.stringify(body));
	if (!bs.ms[body.mid]) return log.error('比赛不存在 mid：', body.mid);
	var mid = body.mid, m = bs.ms[mid], gid = m.gid;
	bs.gs[gid] = mid;
	if(m.ntype == 4)
		pomelo.app.get('matchYQServer').noticeMatch(body);
	else if(m.ntype == 2)
		pomelo.app.get('matchCGServer').noticeMatch(body);
	else if(m.ntype == 3)
		pomelo.app.get('matchCSServer').noticeMatch(body);
};

//比赛报名
server._bsbm = function(me, session, body, next, m) {
    if(m.ntype == 4)
        pomelo.app.get("matchYQServer").bsbm(me, session, body, next);
    else if(m.ntype == 2)
        pomelo.app.get("matchCGServer").bsbm(me, session, body, next);
    else if(m.ntype == 3)
        pomelo.app.get("matchCSServer").bsbm(me, session, body, next);
}
server.bsbm = function(me,session, body, next){
	var mid; var self = this;
	if(body.mid) mid = body.mid;
	if(!mid) mid = bs.cs[body.code];
	if (!mid || !bs.ms[mid]) return next(null, {code: code.FAIL, msg: '暂无比赛！'});
	var m = bs.ms[mid], roundslimit = m.roundslimit;
	var ctime = Math.round(+new Date() / 1000);
    var today = tools.getDateKey(ctime, 'YYYYMMDD');
    if (roundslimit > 0) {
        pomelo.app.rpc.db.dbRemote.getUserLiushui(null, today, session.uid, function(r) {
			if (r && r.valid_round >= roundslimit) {
                self._bsbm(me, session, body, next, m);
			} else {
				var tip = "您今天还没有参加"+roundslimit+"局有效牌局，赶快去和好友玩几把再来吧！";
                return next(null, {code: code.MATCH.NOT_MEET_CONDITION, msg: tip});
			}
        });
    } else {
    	self._bsbm(me, session, body, next, m);
	}



}
//取消报名
server.matchUnsign = function(me,session, body, next){
	var mid;
	if(body.mid) mid = body.mid;
	if(!mid) mid = bs.cs[body.code];
	if (!mid || !bs.ms[mid]) return next(null, {code: code.FAIL, msg: '暂无比赛！'});
	var m = bs.ms[mid];
	if(m.ntype == 4)
		pomelo.app.get("matchYQServer").matchUnsign(me, session, body, next);
	else if(m.ntype == 2)
		pomelo.app.get("matchCGServer").matchUnsign(me, session, body, next);
}
server.forceQuitMatch = function(me,session, body, next){
	var mid = body.mid;
	var m = bs.ms[mid];
	if (!m) return log.error('比赛不存在 mid：', body.mid);
	if(m.ntype == 2)
		pomelo.app.get("matchCGServer").forceQuitMatch(me, session, body, next);
	if(m.ntype == 3)
		pomelo.app.get("matchCSServer").forceQuitMatch(me, session, body, next);
}
//进入房间
server.matchEnterRoom = function(body){
	var mid = body.mid;
	var m = bs.ms[mid];
	if (!m) return log.error('比赛不存在 mid：', body.mid);
	if(m.ntype == 4)
		pomelo.app.get("matchYQServer").matchEnterRoom(body);
	else if(m.ntype == 2)
		pomelo.app.get("matchCGServer").matchEnterRoom(body);
	else if(m.ntype == 3)
		pomelo.app.get("matchCSServer").matchEnterRoom(body);
}
//游戏结束
server.endGame = function(body){
	var gsidtid = body.gid + '_' + body.rtype + "_" + body.ridx + "_" + body.tid;
	var mid = !!bs.mt && !!bs.mt[gsidtid] ? bs.mt[gsidtid] : bs.gs[body.gid];
	if (!mid || !bs.ms[mid]) {
		log.info('比赛不存在',mid);
		return ;
	}
	var m = bs.ms[mid];
	if(m.ntype == 4)
		pomelo.app.get("matchYQServer").endGame(body);
	else if(m.ntype == 2)
		pomelo.app.get("matchCGServer").endGame(body);
	else if(m.ntype == 3)
		pomelo.app.get("matchCSServer").endGame(body);
}
//发送游戏结果
server.matchLastendround = function(body){
	var self = this;
	if(!bs.ms) setTimeout(function(){self.matchLastendround(body);},1000);
	else {
		console.log('比赛结果',JSON.stringify(body));
		var users = body.nusers,gid = body.gid,rtype = body.rtype,ridx = body.ridx,tid = body.tid,mid = 0, stage = 0;

		for (var i in users){
			mid = users[i].mid , stage = users[i].stage;
			var match = bs.ms[mid];
			if(match && [2,3].indexOf(match.ntype) != -1){
				var player = userManager.getOnlineUserSort(users[i].uid);
				player.score = users[i].score;
				var mrdata = {state:0,num:0,rank:0,stage:users[i].stage,score:users[i].score,bend:0};
				if(player && !player.reload) player.sendMsg(pushCmd.matchresult,mrdata);
			}
		}

		var match = bs.ms[mid];
		if(bs.cstable && bs.cstable[mid] && bs.cstable[mid].residue > 0) bs.cstable[mid].residue--;
		// console.log('match',!!match);
		if (match) {
			var server = gsManager.getServerByGSID(match.gsid);
			console.log('发送比赛结果',gid,rtype,ridx,'00','SCOR{0}|{1}|{2}|{3}'.format(mid,tid,stage,JSON.stringify(users)));
			if(server) server.n2s(gid,rtype,ridx,'00','SCOR{0}|{1}|{2}|{3}'.format(mid,tid,stage,JSON.stringify(users)));
		}
	}
}
//获取比赛报名人数
server.getMatchSignNum = function(me,session, body, next){
	var mids = body.mids,data = {};
	for(var i in mids){
		var mid = mids[i];
		if(!bs.ms) bs.ms = {};
		if(!bs.ms[mid] || bs.ms[mid].ntype == 4) {data[mid] = {num:0,state:0};continue;}//比赛不存在,不是常规赛,报名人数为0
		if(bs.ms[mid].ntype == 2){
			var num = bs.mu && bs.mu[mid] ? bs.mu[mid] : 0;
			var state = bs.su && bs.su[mid] && bs.su[mid][session.uid] ? bs.su[mid][session.uid].state : 0;
		}else{
			if(!bs.cstable) bs.cstable = {};
			if(!bs.cstable[mid]) bs.cstable[mid] = 0;
			var tablenum = bs.cstable[mid];
			var num = !!bs.csnum && !!bs.csnum[mid] ? bs.csnum[mid] : 0;
			var allnum = !!bs.csallnum && !!bs.csallnum[mid] ? bs.csallnum[mid] : 0;
			var state = bs.csusers && bs.csusers[mid] && bs.csusers[mid][session.uid] ? bs.csusers[mid][session.uid] : 0;
		}
		data[mid] = {num:num,state:state,tablenum:!!tablenum?tablenum:0,allnum:!!allnum?allnum:0}
	}
	//console.log('getMatchSignNum',session.uid,JSON.stringify(data))
	next(null,{code:code.OK,data:data});
}
//前端获取比赛状态
server.match = function(me,session, body, next){
	var uid = session.uid;
	var player = userManager.getOnlineUserSort(uid);
	if(player.mid && !player.type){
		var mid = player.mid;
		var m = bs.ms[mid];
		if(!m) return next(null,{code:code.FAIL});
		if (m.ntype == 2) {//常规赛
			var musers = bs.su[mid];
			if (musers[uid]) {
				var state = musers[uid].state,stage = player.stage?player.stage:0;
				var num = bs.mu[mid];
				var data = {code:code.OK, m: m, num: num,state: state, stage:stage};
				return next(null,data);
			}
		} else if (m.ntype == 3){//锦标赛
			if(!bs.cstable) bs.cstable = {};
			if(!bs.cstable[mid]) bs.cstable[mid] = 0;
			var tablenum = bs.cstable[mid];
			var users = bs.csusers[mid],stage = player.stage?player.stage:0;
			if(users[uid]){
				var num = !!bs.csnum && !!bs.csnum[mid] ? bs.csnum[mid] : 0;
				var allnum = !!bs.csallnum && !!bs.csallnum[mid] ? bs.csallnum[mid] : 0;
				var state = users[uid];//1 报名,等待中 2 进桌中 3 进入游戏 4 等待晋级
				var phase = !!bs.phase && !!bs.phase[mid] ? bs.phase[mid] : 0;
				var data = {code:code.OK, m: m,state:state,stage:stage,num:num,phase:phase,tablenum:tablenum,allnum:allnum};
				return next(null,data);
			}
		}
	}
	return next(null,{code:code.FAIL});
}

server.matchRank = function(body){
	var mid = body.mid;
	var m = bs.ms[mid];
	if (!m) return log.error('比赛不存在 mid：', body.mid);
	if(m.ntype == 2)
		pomelo.app.get("matchCGServer").matchRank(body);
	else if(m.ntype == 3)
		pomelo.app.get("matchCSServer").matchRank(body);
}

server.matchEnd = function(gsid){
	for (var mid in bs.ms) {
		var m = bs.ms[mid];
		if(m.gsid == gsid) {
			if(m.ntype == 4) pomelo.app.get('matchYQServer').matchEnd(m.gid,mid);
			if(m.ntype == 2) pomelo.app.get('matchCGServer').matchEnd(m.gid,mid);
			if(m.ntype == 3) pomelo.app.get('matchCSServer').matchEnd(m.gid,mid);
		}
	}
}
//比赛淘汰清除玩家数据
server.removeUser = function(uid,isonline){
	userManager.removeUserSort(uid,true);
	if(!isonline) pomelo.app.rpc.db.dbRemote.deleteUserOnline(null, uid);
}

module.exports = {
	name: "hall",
	beans: [{
		id: "MatchServer",
		func: MatchServer,
		runupdate: 'init',
		scope: "singleton"
	}]
};


