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

var MatchCSServer = function() { };
var server = MatchCSServer.prototype;

server.init = function(){
	if(pomelo.app.getServerType()!="hall")return;
	if (!bs.ms) bs.ms = {}; //存所有比赛信息
	if (!bs.gs) bs.gs = {}; //存所有比赛gid=>mid

	if (!bs.csusers) bs.csusers = {};//锦标赛确认用户
	if (!bs.mt) bs.mt = {};
	if (!bs.csnum) bs.csnum = {};//锦标赛人数
	if (!bs.csallnum) bs.csallnum = {};//锦标赛人数
	if (!bs.cstable) bs.cstable = {};
	if (!bs.phase) bs.phase = {};
};

server.initUser = function(userinfo){
	var uid = userinfo.uid,mid = userinfo.mid;
	var m = bs.ms[mid];
	if(!m) return;

	if(!bs.csusers) bs.csusers = {};
	if(!bs.csusers[mid]) bs.csusers[mid] = {};

	bs.csusers[mid][uid] = userinfo.stage;

	var player = userManager.getOnlineUserSort(uid);
	if(player){
		player.mid = mid;
		player.stage = userinfo.stage;
		player.type = userinfo.qt;
	}else{
		var user = {uid:uid,mid:mid,stage:userinfo.stage,type:userinfo.qt};
		userManager.addUserSort(uid,null,user);
	}
}

server.noticeMatch = function(body) {
	if (!bs.ms[body.mid]) return log.error('比赛不存在 mid：', body.mid);
	var mid = body.mid, m = bs.ms[mid], gid = m.gid,time = tools.getSystemSecond();
	bs.gs[gid] = mid;
	if(body.rel == 1) console.log('锦标赛开始');
	else if (body.rel == 4) { //比赛确认通知

	}
};

//比赛报名
server.bsbm = function(me,session, body, next){
	var mid = body.mid;
	if (!mid || !bs.ms[mid]) return next(null, {code: code.FAIL, msg: '暂无比赛！'});
	var m = bs.ms[mid],uid = session.uid,time = tools.getSystemSecond();

	var starttime = m.starttime;
	var confirmtime = starttime - m.confirmtime2;

	if(!bs.csusers) bs.csusers = {};
	if(!bs.csusers[mid]) bs.csusers[mid] = {};

	if(bs.csusers[mid][uid]) return next(null, {code: code.FAIL, msg: '已经确认参赛！', match: m});

	if(time < confirmtime) return next(null, {code: code.FAIL, msg: '还未到确认参赛时间!', match: m});
	if(time > starttime) return next(null, {code: code.FAIL, msg: '比赛已开始,确认参赛失败!', match: m});

	var len = p2p.mj.nouse[m.gid] ? p2p.mj.nouse[m.gid].length : 0;
	if (len == 0) return next(null, {code: code.FAIL, msg: '本次比赛服务器已满，请稍后再试。', match: m });

	var confirmCallback = function(body){
		console.log('锦标赛确认报名',JSON.stringify(body));
		if (body.rel == 0) {
			bs.csusers[body.mid][body.uid] = 1;
			pomelo.app.rpc.db.dbRemote.updateCSMatchSign(null,body.uid,body.mid,function(){})
			if(!bs.csnum) bs.csnum = {};
			if(!bs.csnum[mid]) bs.csnum[mid] = 0;
			bs.csnum[mid] += 1;
			if(!bs.csallnum) bs.csallnum = {};
			if(!bs.csallnum[mid]) bs.csallnum[mid] = 0;
			bs.csallnum[mid] += 1;
			userManager.addUserSort(body.uid,null,{mid:mid,type:0});
			return next(null, {code: code.OK, match: m,num:bs.csnum[mid]});
		} else {
			return next(null, {code: code.FAIL, msg: '确认参赛失败,请重试！', match: m});
		}
	}

	pomelo.app.rpc.db.dbRemote.getCSMatchSign(null,uid,mid,function(r){
		if(r){
			if (r.state == 1) {
				var server = gsManager.getServerByGSID(m.gsid);
				if (server) {
					server.sendString('03SIGN{0}|{1}|{2}|{3}'.format(gsManager.getTick(confirmCallback), mid, session.uid, 0));
				}else{
					return next(null, {code: code.FAIL, msg: '确认参赛失败,请重试！', match: m});
				}
			} else if (r.state == 3){
				bs.csusers[mid][r.uid] = 1;
				return next(null, {code: code.FAIL, msg: '已经确认参赛！', match: m});
			} else {
				return next(null, {code: code.FAIL, msg: '未报名参加比赛,确认参赛失败！', match: m});
			}
		}else{
			return next(null, {code: code.FAIL, msg: '未报名参加比赛,确认参赛失败！', match: m});
		}
	})
}

server.forceQuitMatch = function(me, session, body, next){
	var mid = body.mid,self = this;
	var m = bs.ms[mid];
	if(!m) return next(null, {code: code.FAIL, msg: '比赛不存在！', match: m});

	var player = userManager.getOnlineUserSort(session.uid);
	if(!player) return next(null, {code: code.FAIL, msg: '未参加比赛,强制退赛失败！', match: m});

	if(!bs.csusers[mid] || !bs.csusers[mid][session.uid] || !player.mid) return next(null, {code: code.FAIL, msg: '未参加比赛,强制退赛失败！', match: m});

	var FQCallback = function(body){
		var player = userManager.getOnlineUserSort(body.uid);
		if(player){
			delete player.gsid;
			delete player.tableid;
			player.type = 1;
		}
		return next(null, {code: code.OK});
	}

	if(m.gsid) var server = gsManager.getServerByGSID(m.gsid);
	if (server) {
		server.sendString('03FQIT{0}|{1}'.format(gsManager.getTick(FQCallback), session.uid));
	} else {
		return next(null, {code: code.FAIL, msg: '退赛失败,请重试！', match: m});
	}
}

//玩家进桌
server.matchEnterRoom = function(body){
	console.log('锦标赛分桌',JSON.stringify(body));
	var tableusers = body.tableusers , mid = body.mid , stage = body.stage, round = body.round;
	var m = bs.ms[mid];
	if(!m) return;//比赛不存在
	var obj = {},gobj = {};
	for(var k in m.game) {obj[k] = m.game[k]; gobj[k] = m.game[k];}
	gobj.mid = mid; gobj.stage = stage; gobj.round = round;gobj.rounds = round > 0 ? round : 1;
	if(!bs.cstable) bs.cstable = {};
	bs.cstable[mid] = {all:0,residue:0};
	for(var i in tableusers) {
		bs.cstable[mid].all++;
		bs.cstable[mid].residue++;
		this.enterRoom(tableusers[i],mid,gobj,obj);
	}
}
server.enterRoom = function(tableuser,mid,gobj,obj){
	var m = bs.ms[mid],self = this;
	if(!m) return;//比赛不存在
	var gid = tableuser.gid,rtype = tableuser.rtype,ridx = tableuser.ridx,tid = tableuser.tid,users = tableuser.users;
	var len = users.length;
	var gsidtid = gid + '_' + rtype + '_' + ridx + '_' + tid;
	var gsid = gid + '_' + rtype + '_' + ridx;

	//桌子mid
	if (!bs.mt) bs.mt = {};
	bs.mt[gsidtid] = mid;

	while(p2p.mj.nouse[gid].indexOf(gsidtid) != -1) {
		var index = p2p.mj.nouse[gid].indexOf(gsidtid);
		p2p.mj.nouse[gid].splice(index, 1);
	}
	var code = randomAssignGameTable.randCode();
	obj.gsid = gsid;obj.tid = tid,obj.uid = users[0],obj.mid = mid,obj.code = code;
	pomelo.app.rpc.db.dbRemote.createUserRooms(null, obj, 0, function(lid) {//插入桌子数据
		for (var k in users){
			var uid = users[k];
			gobj.mlid = 0;gobj.lid = lid;gobj.code = code;
			var instate = parseInt(bs.csusers[mid][uid]) || 1;
			gobj.beishu = 1;
			if(gobj.stage == 1 && instate != 1) {
				var phase = !!bs.phase && !!bs.phase[mid] ?parseInt(bs.phase[mid]) : 1;
				gobj.beishu = phase + 1;
			}
			if(gobj.stage == 2) instate = 1;
			var msg = { gid: gid, rtype: rtype, ridx: ridx, quick:0, tableid: tid, mid: mid , gobj: gobj,initscore:m.initscore,state:instate};
			//console.log('createUserRooms',JSON.stringify(msg));
			randomAssignGameTable.addUserToTable(gsidtid, parseInt(uid));
			userManager.addUserSort(uid,null,{mid:mid,stage:gobj.stage}).then(function(player){
				self.userToGame(uid,player,gsidtid,m,msg);
			})
		}
		if(len < m.chairs){
			var motor_num = parseInt(m.chairs) - len;
			pomelo.app.rpc.db.dbRemote.getMotors(null,motor_num,function(motors){
				var uids = [];
				for(var mi in motors){
					console.log('锦标赛机器人',motors[mi].uid);
					var uid = motors[mi].uid;uids.push(uid);
					userManager.addUserSort(uid,null,motors[mi]).then(function(player){
						player.mid = player.mid;
						player.stage = gobj.stage;
						gobj.mlid = 0;gobj.lid = lid;gobj.code = code;gobj.beishu = 1;
						if(gobj.stage == 1 && instate != 1) {
							var phase = !!bs.phase && !!bs.phase[mid] ? parseInt(bs.phase[mid]) : 1;
							gobj.beishu = phase + 1;
						}
						var msg = { gid: gid, rtype: rtype, ridx: ridx, quick:0, tableid: tid, mid: mid , gobj: gobj,initscore:m.initscore,state:1,motor:1};
						randomAssignGameTable.addUserToTable(gsidtid, parseInt(uid));
						self.userToGame(uid,player,gsidtid,m,msg);
					});
				}
				if(uids.length > 0) pomelo.app.rpc.db.dbRemote.updateMotor(null,uids,function(){});
			})
		}
	});
}
server.userToGame = function(uid,player,gsidtid,m,msg){
	var gdata = gsidtid.split('_'),mid = m.mid;
	gsManager.enterToGame(player, msg, player.locale || 'zh_CN', function(result) {
		console.log('锦标赛进桌',uid,JSON.stringify(result));
		if (!result.uid) result.uid = uid;
		if (result.rel != 0) log.info(5, '比赛进入游戏失败:', gsidtid, uid, JSON.stringify(result));
		if (result.rel == 0) {
			var server = gsManager.getServerByGSID(m.gsid);
			if(server) server.n2s(gdata[0],gdata[1],gdata[2],'00','MSG0{0}|{1}|{2}|{3}|{4}'.format(mid,uid,player.mlid,gdata[3],0));
			bs.csusers[mid][uid] = 3;
		}
	});
}

server.matchRank = function(body){
	var mid = body.mid;
	console.log('锦标赛晋级结果',JSON.stringify(body));
	console.log('锦标赛玩家',mid,JSON.stringify(bs.csusers[mid]));
	if(!bs.cstable) bs.cstable = {};
	if(!bs.cstable[mid]) bs.cstable[mid] = {all:0,residue:0};
	var tablenum = bs.cstable[mid];
	if(body.stage > 1){
		var num = 0;
		for(var i in body.users) num++;
		for(var i in body.users){
			var u = body.users[i];
			var player = userManager.getOnlineUserSort(u.uid);
			if(u.bup == 0 ){//玩家淘汰删除数据
				delete bs.csusers[mid][u.uid];
				bs.csnum[mid]--;
				if(player){
					delete player.mid;
					delete player.type;
					delete player.stage;
					delete player.rank;
					delete player.score;
					delete player.num;
					if(player.reload) delete player.sid;
					pomelo.app.get('matchServer').removeUser(u.uid,player.reload?false:true);//清除不在线玩家信息
				}
			}else{
				player.rank = u.rank;
				player.score = u.score;
				player.num = num;
				player.stage = parseInt(body.stage)+1;
			}
			console.log('锦标赛第二阶段晋级',JSON.stringify(u));
			player = userManager.getOnlineUserSort(u.uid);//查看玩家是否在线
			if(player && u.bleave == 0) {
				var data = {state:u.bup==1?1:2,num:num,rank: u.rank,score: u.score,bend:body.bend,stage:body.stage,mid:mid,phase:0,tablenum:tablenum};
				player.sendMsg(pushCmd.matchresult,data);
			}
		}
	}else{
		var szinfo = !!body.szinfo ? body.szinfo : '';
		var phase = 1;num = !!bs.csnum && !!bs.csnum[mid] ? bs.csnum[mid] : 0;
		if(szinfo){
			szinfo = eval('(' + szinfo + ')');
			phase = parseInt(szinfo.lid) || 1;
			num = szinfo.num;
		}
		if (!bs.phase) bs.phase = {};
		bs.phase[mid] = phase;
		for(var i in body.users){
			var u = body.users[i],player = userManager.getOnlineUserSort(u.uid),data = {};
			if(u.bup == 0 || u.bup == 2 || u.bleave == 1){
				bs.csnum[mid]--;
				delete bs.csusers[u.uid];
				if(player){
					delete player.mid;
					delete player.type;
					delete player.stage;
					delete player.rank;
					delete player.score;
					delete player.num;
					if(player.reload) delete player.sid;
					pomelo.app.get('matchServer').removeUser(u.uid,player.reload?false:true);
					data = {state:2,num:0,rank: 0,score: u.score,bend:0,stage:1,mid:mid,mlid:0};
					player = userManager.getOnlineUserSort(u.uid);
				}
			} else if(u.bup == 3) {
				data = {state:3,rank: 0,score: u.score,bend:0,stage:1,mid:mid,mlid:0,phase:phase,num:num,tablenum:tablenum};//第一阶段重赛
			} else if(u.bup == 1) {
				data = {state:1,rank: 0,score: u.score,bend:0,stage:1,mid:mid,mlid:0,phase:phase,num:num,tablenum:tablenum};//第一阶段晋级
			}
			console.log('锦标赛第一阶段晋级结果',JSON.stringify(u), JSON.stringify(data));
			if(player && u.bleave == 0) {
				player.sendMsg(pushCmd.matchresult,data);
			}
		}
	}
	console.log('锦标赛玩家',mid,JSON.stringify(bs.csusers[mid]));
}
//游戏结束
server.endGame = function(body) {
	console.log('锦标赛,每局游戏结束：', JSON.stringify(body));
	var gsid = body.gid + '_' + body.rtype + "_" + body.ridx;
	var gsidtid = gsid + '_' + body.tid;
	pomelo.app.rpc.db.dbRemote.removeUserRooms(null, body.code, 1); //结束不退卡
	randomAssignGameTable.deleteByUse(gsidtid, body.code, sys['SYS_MAINTENANCE_' + gsid]); //删除已经使用

	var mid = 0;
	if(!bs.mt) bs.mt = {};
	mid = !!bs.mt[gsidtid] ? bs.mt[gsidtid] : 0;
	mid = mid ? mid : bs.gs[body.gid];

	if(!!bs.mt[gsidtid]) delete bs.mt[gsidtid];

	var server = gsManager.getServerByGSID(gsid);
	if (!!server) {
		var table = server.getTable(body.tid);
		if (!!table) table.dispose();
	}

	for (var key in body.musers) {
		var uid = body.musers[key].uid;
		bs.csusers[mid][uid] = 4;
		var player = userManager.getOnlineUserSort(uid);
		if(player && player.motor && player.motor == 1) {
			delete player.sid;
			delete player.mid;
			delete bs.csusers[mid][uid];
			pomelo.app.get('matchServer').removeUser(uid,false);//清除不在线玩家信息
		}
	}
};

server.matchEnd = function(gid,mid){
	var key = gid + '_';
	for (var gsid in serversort) {
		if (gsid.indexOf(key) == 0) pomelo.app.get('gameserverManager').kickAllTable(gsid);
	}
	if(!bs.csusers) bs.csusers = {};
	if(!!bs.csusers[mid]) {
		for(var uid in bs.csusers[mid]) {
			var player = userManager.getOnlineUserSort(uid);
			if (player) {
				delete player.mid;
				delete player.type;
				delete player.stage;
				delete player.rank;
				delete player.score;
				delete player.num;
				if(player.reload) delete player.sid;
				pomelo.app.get('matchServer').removeUser(uid,player.reload?false:true);//清除不在线玩家信息
				player = userManager.getOnlineUserSort(uid);//查看玩家是否在线
				if (player) {
					var data = {state: 2, num: 0, rank: 0, score: 0, bend: 0, stage: 0, mid: mid, mlid: 0};
					player.sendMsg(pushCmd.matchresult, data);
				}
			}
			delete bs.csusers[mid][uid];
		}
	}
	console.log('锦标赛玩家',mid,JSON.stringify(bs.csusers[mid]));
}

module.exports = {
	name: "hall",
	beans: [{
		id: "MatchCSServer",
		func: MatchCSServer,
		runupdate: 'init',
		scope: "singleton"
	}]
};


