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
var serversort = require("./StoreDatas").serversort;
var sys = require("./StoreDatas").sys;
var bs = require("./StoreDatas").bs;
var p2p = require("./StoreDatas").p2p;

var MatchYQServer = function() { };
var server = MatchYQServer.prototype;

server.init = function(){
	if(pomelo.app.getServerType()!="hall")return;
	if (!bs.ms) bs.ms = {}; //存所有比赛信息
	if (!bs.gs) bs.gs = {}; //存所有比赛gid=>mid
	if (!bs.ss) bs.ss = {}; //存比赛状态0未开始 1开始 2结束
	if (!bs.cs) bs.cs = {}; //存比赛code=>mid

	if (!bs.es) bs.es = {}; //邀请赛游戏中用户 状态 1 匹配 2 进入
	if (!bs.ur) bs.ur = {}; //邀请赛用户当前局数
	if (!bs.yqtable) bs.yqtable = {};//邀请赛桌子上的玩家
	if (!bs.mt) bs.mt = {};//桌子mid
};

//重启初始化比赛用户信息
server.initUser = function(userinfo){
	var uid = userinfo.uid,mid = userinfo.mid;
	var m = bs.ms[mid];
	if(!m) return;

	if (userinfo.state == 3) {//在游戏中,初始用户数据
		if(!bs.es[mid]) bs.es[mid] = {};
		bs.es[mid][uid] = 3;//记录比赛数据
		var player = userManager.getOnlineUserSort(uid);
		if (player) {
			player.mid = mid;
		} else {
			userManager.addUserSort(uid,null,{uid:uid,mid:mid});
		}
	} else {//不在游戏中取消报名
		var server = gsManager.getServerByGSID(m.gsid);
		if(server) server.sendString('03USIN{0}|{1}|{2}|{3}'.format(gsManager.getTick(function(body){}), mid, uid, 0));
	}
}

server.noticeMatch = function(body) {
	console.log("noticeMatch:", JSON.stringify(body));
	if (!bs.ms[body.mid]) return log.error('比赛不存在 mid：', body.mid);
	var mid = body.mid, m = bs.ms[mid], gid = m.gid;
	var date = parseInt((new Date()).format('yyyyMMdd'));
	if(m.startdate > date || m.enddate < date) return;
	bs.gs[gid] = mid;
	if (body.rel == 1) { //开始
		bs.ss[mid] = 1;
		log.info(1, '邀请赛开始 mid：', mid, gid);
	} else if (body.rel == 2 || body.rel == 100) { //结束
		bs.ss[mid] = 2;
		this.matchEnd(gid, mid);
	}
};

//比赛报名
server.bsbm = function(me, session, body, next){
	var mid = bs.cs[body.code];
	var m = bs.ms[mid], time = tools.getSystemSecond(),curr = (bs.ur[mid] && bs.ur[mid][session.uid] ? bs.ur[mid][session.uid] : 0) + 1;

	if(!bs.es[mid]) bs.es[mid] = {};

	if(!m) return next(null, {code: code.FAIL, msg: '比赛不存在！'});

	if (bs.ss[mid] == 0)
		return next(null, {code: code.FAIL, msg: '比赛未开始！',match: m, state: 0, time: time, curr: curr });
	else if (bs.ss[mid] == 2)
		return next(null, {code: code.FAIL, msg: '比赛已经结束！',match: m , state: 2, time: time, curr: curr });

	if(curr > m.minround)
		return next(null, {code: code.FAIL, msg: '您已经打完{0}局！'.format(m.minround), match: m, state: 2, time: time, curr: curr });

	var len = p2p.mj.nouse[m.gid] ? p2p.mj.nouse[m.gid].length : 0;
	if (len == 0) return next(null, {code: code.FAIL, msg: '本次比赛服务器已满，请稍后再试。', match: m , state: 3, time: time, curr: curr});

	var player = userManager.getOnlineUserSort(session.uid);
	if (m.uday && m.uday > 0) {
		var check = player.reg_date && time - player.reg_date > m.uday*86400;
		if (check) {
			console.error('您不满足参赛条件1！', session.uid);
			return next(null, {code: code.FAIL, msg: '您不满足参赛条件！', match: m, state: 3, time: time, curr: curr });
		}
	}
	if (m.ucards && m.ucards > 0) {
		if (player.room_card && player.room_card < m.ucards) {
			console.error('您不满足参赛条件2！', session.uid, player.room_card);
			return next(null, {code: code.FAIL, msg: '您不满足参赛条件！', match: m, state: 3, time: time, curr: curr});
		}
	}

	if(!!player.mid) return next(null, {code: code.FAIL, msg: '已经报名参加比赛！', match: m , state: 3, time: time, curr: curr});

	if(!!player.tableid) return next(null, {code: code.FAIL, msg: '已在游戏内,参加比赛失败！', match: m , state: 3, time: time, curr: curr});

	var date = parseInt((new Date()).format('yyyyMMdd'));
	pomelo.app.rpc.db.dbRemote.getYQSign(null,player.uid,mid,date,function(sign){
		if(sign){

			if(m.minnum > 0 && sign.total < m.minnum){
				return next(null, {code: code.FAIL, msg: '报名人数不足,比赛未进行！', match: m , state: 3, time: time, curr: curr});
			}

			var bsbmCallback = function(body) {
				log.info('邀请赛报名',JSON.stringify(body));
				if (body.type == 0) {//报名返还
					if (body.rel == 0) {//报名成功
						bs.es[mid][body.uid] = 1;
						player.mid = body.mid;
						return next(null,{code: code.OK, match: m, state: 1, time: time, curr: curr});
					} else {
						var msg = ['比赛不存在,报名失败!','已在比赛中,报名失败!','报名生成失败,请重试!','比赛状态不对!','比赛报名人数已满!'];
						var msgtype = parseInt(body.rel)-1;
						return next(null, {code: code.FAIL, msg: msg[msgtype]?msg[msgtype]:'参加比赛失败,请重试！', match: m , state: 3, time: time, curr: curr});
					}
				}
			}

			var server = gsManager.getServerByGSID(m.gsid);
			if (server) {
				console.log("03SIGN",  mid, session.uid);
				server.sendString('03SIGN{0}|{1}|{2}|{3}'.format(gsManager.getTick(bsbmCallback), mid, session.uid, 0));
			}else{
				return next(null, {code: code.FAIL, msg: '参加比赛失败,请重试！', match: m , state: 3, time: time, curr: curr});
			}
		}else{
			return next(null, {code: code.FAIL, msg: '未报名比赛,参数失败！', match: m , state: 3, time: time, curr: curr});
		}
	})
}

//取消报名
server.matchUnsign = function(me, session, body, next){
	var mid = bs.cs[body.code];
	if (!mid || !bs.ms[mid]) return next(null, {code: code.FAIL, msg: '暂无比赛！'});
	var m = bs.ms[mid];

	var state = !!bs.es && !!bs.es[mid] && bs.es[mid][session.uid] ? bs.es[mid][session.uid] : 1;

	if(state > 1) return next(null,{code:code.FAIL,msg:'比赛已开始,退出比赛失败!'});

	var matchUnsignCallback = function(body){
		log.info('邀请赛取消报名',JSON.stringify(body));
		if (body.rel == 0) {
			delete bs.es[mid][body.uid];
			var player = userManager.getOnlineUserSort(body.uid);
			if(player) delete player.mid;
			return next(null, {code: code.OK});
		} else {
			return next(null, {code: code.FAIL, msg: '取消报名失败,请重试！'});
		}
	}

	if(m.gsid) var server = gsManager.getServerByGSID(m.gsid);
	//console.log(server);
	if (server) {
		server.sendString('03USIN{0}|{1}|{2}|{3}'.format(gsManager.getTick(matchUnsignCallback), mid, session.uid, 0));
	} else {
		return next(null, {code: code.FAIL, msg: '取消报名失败,请重试！', match: m});
	}
}
//玩家进桌
server.matchEnterRoom = function(body){
	log.info('邀请赛分桌',JSON.stringify(body));
	var tableusers = body.tableusers , mid = body.mid , stage = body.stage, round = body.round;
	var m = bs.ms[mid];
	if(!m) return;//比赛不存在
	var obj = {},gobj = {};
	for(var k in m.game) {obj[k] = m.game[k]; gobj[k] = m.game[k];}
	gobj.mid = mid; gobj.stage = stage; gobj.round = round;
	for(var i in tableusers) this.enterRoom(tableusers[i],mid,gobj,obj);
}
server.enterRoom = function(tableuser,mid,gobj,obj){
	var m = bs.ms[mid],self = this;
	if(!m) return;//比赛不存在
	var gid = tableuser.gid,rtype = tableuser.rtype,ridx = tableuser.ridx,tid = tableuser.tid,users = tableuser.users;
	var gsidtid = gid + '_' + rtype + '_' + ridx + '_' + tid;
	while(p2p.mj.nouse[gid].indexOf(gsidtid) != -1) {
		var index = p2p.mj.nouse[gid].indexOf(gsidtid);
		p2p.mj.nouse[gid].splice(index, 1);
	}

	if (!bs.yqtable) bs.yqtable = {};
	bs.yqtable[gsidtid] = users;

	if (!bs.mt) bs.mt = {};
	bs.mt[gsidtid] = mid;

	this.createMatchRoom(users,m,obj,gobj,gsidtid);
}

server.createMatchRoom = function(users,m,obj,gobj,gsidtid){
	var code = randomAssignGameTable.randCode();
	var mid = m.mid,self = this;
	var matchserver = gsidtid.split('_');
	var gsid = matchserver[0] + '_' + matchserver[1] + '_' + matchserver[2];
	obj.gsid = gsid;obj.tid = matchserver[3],obj.uid = users[0],obj.mid = mid,obj.code = code;
	pomelo.app.rpc.db.dbRemote.createUserRooms(null, obj, 0, function(lid) {//插入桌子数据
		log.info('createUserRooms',JSON.stringify(obj),lid,JSON.stringify(users));
		for (var k in users){
			var uid = users[k];
			if(!bs.es) bs.es = {};
			if(!bs.es[mid]) bs.es[mid] = {};
			bs.es[mid][uid] = 2;
			gobj.mlid = 0;gobj.lid = lid;gobj.code = obj.code;
			var msg = { gid: matchserver[0], rtype: matchserver[1], ridx: matchserver[2], quick:0, tableid: matchserver[3], mid: mid , gobj: gobj};
			log.info('userEnter',uid,JSON.stringify(msg));
			self.userEnter(uid,mid,gsidtid,m,msg);
		}
	});
}

server.userEnter = function(uid,mid,gsidtid,m,msg){
	var self = this;
	userManager.addUserSort(uid,null,{mid:mid}).then(function(player) {
		self.userToGame(uid, player, gsidtid, m, msg);
	});
}

server.userToGame = function(uid,player,gsidtid,m,msg){
	var gdata = gsidtid.split('_'),mid = m.mid;
	gsManager.enterToGame(player, msg, player.locale || 'zh_CN', function(result) {
		log.info('邀请赛进桌',uid,JSON.stringify(result));
		if (!result.uid) result.uid = uid;
		if (result.rel != 0) log.info(5, '比赛进入游戏失败:', gsidtid, uid, JSON.stringify(result));
		if (result.rel == 0) {
			randomAssignGameTable.addUserToTable(gsidtid, uid);
			var server = gsManager.getServerByGSID(m.gsid);
			if(server) server.n2s(gdata[0],gdata[1],gdata[2],'00','MSG0{0}|{1}|{2}|{3}|{4}'.format(mid,uid,0,gdata[3],0));
			bs.es[mid][uid] = 3;
		}
	});
}

//游戏结束
server.endGame = function(body) {
	log.info('邀请赛,每局游戏结束：', JSON.stringify(body));
	var gsid = body.gid + '_' + body.rtype + "_" + body.ridx;
	var gsidtid = gsid + '_' + body.tid;
	pomelo.app.rpc.db.dbRemote.removeUserRooms(null, body.code, 1); //结束不退卡
	randomAssignGameTable.deleteByUse(gsidtid, body.code, sys['SYS_MAINTENANCE_' + gsid]); //删除已经使用

	var mid = !!bs.mt && !!bs.mt[gsidtid] ? bs.mt[gsidtid] : bs.gs[body.gid];

	var users = body.uids;//正常结束可能桌子已被分配原来的数据已被覆盖,已去服务端传回来的值

	if(body.rel == 1){
		users = !!bs.yqtable && !!bs.yqtable[gsidtid] ? bs.yqtable[gsidtid] : body.uids;//非正常结束,桌子不可能被重新分配,用内存中数据
		var m = bs.ms[mid];
		var server = gsManager.getServerByGSID(m.gsid);
		if(server) {
			server.n2s(body.gid,body.rtype,body.ridx,'00','FAIL{0}|{1}|{2}'.format(mid,body.tid,JSON.stringify(users)))
			for(var key in users) server.sendString('01DUSR'+users[key]);
		}
	}

	if (bs.es[mid]) {
		//清理用户进入游戏状态
		for (var key in users) {
			var uid = users[key];
			if(body.rel == 0) {//记录局数
				if (!bs.ur[mid]) bs.ur[mid] = {};
				if (!bs.ur[mid][uid]) bs.ur[mid][uid] = 0;
				bs.ur[mid][uid]++;
			}

			var player = userManager.getOnlineUserSort(uid);
			if(player){
				delete player.mid;
				if(player.reload) delete player.sid;
				pomelo.app.get('matchServer').removeUser(uid,player.reload?false:true);//清除不在线玩家信息
			}
			delete bs.es[mid][uid];
		}
	}
	log.info('bs.ur',JSON.stringify(bs.ur));

	if(!!bs.yqtable && !!bs.yqtable[gsidtid]) delete bs.yqtable[gsidtid];
	if(!!bs.mt && !!bs.mt[gsidtid]) delete bs.mt[gsidtid];

	var server = gsManager.getServerByGSID(gsid);
	if (!!server) {
		var table = server.getTable(body.tid);
		if (!!table) table.dispose();
	}
};

//比赛结束
server.matchEnd = function(gid, mid) {
	log.warn(6, '邀请赛比赛结束，参与用户：', JSON.stringify(bs.es[mid]), JSON.stringify(bs.ur[mid]));
	var key = gid + '_';
	for (var gsid in serversort) {
		if (gsid.indexOf(key) == 0) pomelo.app.get('gameserverManager').kickAllTable(gsid);
	}
	for (var u in bs.es[mid]) {
		var player = userManager.getOnlineUserSort(u);
		if(player) delete player.mid;
		delete bs.es[mid][u];
	}
	for (var u in bs.ur[mid]) {
		var player = userManager.getOnlineUserSort(u);
		if(player) delete player.mid;
		delete bs.ur[mid][u];
	}
	log.warn(6, '邀请赛比赛结束，参与用户：', JSON.stringify(bs.es[mid]), JSON.stringify(bs.ur[mid]));
	setTimeout(function(){
		var date = parseInt((new Date()).format('yyyyMMdd'));
		log.info('比赛排名',mid,date);
		pomelo.app.rpc.db.dbRemote.matchYQRank(null,mid,date,function(){});
	},5000);
};

module.exports = {
	name: "hall",
	beans: [{
		id: "MatchYQServer",
		func: MatchYQServer,
		runupdate: 'init',
		scope: "singleton"
	}]
};