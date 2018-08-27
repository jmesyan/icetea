var log = require('pomelo-logger').getLogger("hall", "DBManager");
var pomelo = require('pomelo');
var Tools = require('../GameUtils/Tools');

var DBManager = function() {
	//标识单例
	this.$scope = "singleton";
};

var dbm = DBManager.prototype;

//进入大厅在线
dbm.addUserOnline = function(d, cb) {
	if (d.uid) {
		var unix = Math.round(+new Date() / 1000);
		var obj = { userid: d.uid, gid: 0, rtype: 0, ridx: 0, tid: 0, pos: 0, login_time: unix, update_time: unix };
		if (d.gsid) {
			var gsid = d.gsid.split('_');
			obj.gid = gsid[0] || 0;
			obj.rtype = gsid[1] || 0;
			obj.ridx = gsid[2] || 0;
			obj.tid = d.tableid || 0;
			obj.pos = d.pos || 0;
		}
		pomelo.app.get('db').inserttablem('yly_online', obj, null, true);
	}
	if (cb) cb();
};
//退出游戏 回到大厅
dbm.removeUserOnline = function(uid, cb) {
	var unix = Math.round(+new Date() / 1000);
	var obj = { update_time: unix, gid: 0, rtype: 0, ridx: 0, tid: 0, pos: 0 };
	pomelo.app.get('db').updatetablem('yly_online', obj, { userid: uid });
	if (cb) cb();
};
//服务器重启 清理在线 全部回到大厅
dbm.removeUserOnlineByServer = function(gid, rtype, ridx, cb) {
	var unix = Math.round(+new Date() / 1000);
	var obj = { update_time: unix, gid: 0, rtype: 0, ridx: 0, tid: 0, pos: 0 };
	pomelo.app.get('db').updatetablem('yly_online', obj, { gid: gid, rtype: rtype, ridx: ridx });
	if (cb) cb();
};
//退出大厅
dbm.deleteUserOnline = function(uid, cb) {
	pomelo.app.get('db').deletetablem('yly_online', { userid: uid });
	if (cb) cb();
};

//用户在线时长
dbm.updateUserOnlineTime = function(uid, start, cb) {
	var end = Math.round(+new Date() / 1000);
	var time = end - (start || end);
	var sql = 'update user_achievement set onlinetime=onlinetime+' + time + ' where uid=' + uid;
	pomelo.app.get('db').newQuery(sql);

	var day = Tools.getDateKey(start, 'YYYYMMDD');
	sql = 'insert into log_user_liushui(ldate,uid,onlinetime) value('+day+','+uid+','+time+') on duplicate key update onlinetime=onlinetime+' + time;
	pomelo.app.get('db').newQuery(sql);
	if (cb) cb();
};

//创建房间
dbm.createUserRooms = function (obj, lid, cb) {
	obj.ltime = Math.round(+new Date() / 1000);
	var sql = 'insert into log_create_rooms set ?';
	pomelo.app.get('db').query(sql, obj, function(result){
		if (cb) cb(result && result.insertId ? result.insertId : 0);
		
		if (!result || !result.insertId) return;
		obj.lid = result.insertId;

		var sql = 'insert into game_mj_rooms set ?';
		pomelo.app.get('db').query(sql, obj);

		if (lid) pomelo.app.get('db').query('update log_user_golds set lid2=? where lid=?', [obj.lid, lid]);
	});
};
//房间结束
dbm.removeUserRoomByCode = function(code, cb) {
	var sql = 'delete from game_mj_rooms where code=?';
	pomelo.app.get('db').query(sql, [code]);
	if (cb) cb();
};
dbm.removeUserRooms = function (code, state, cb) {
	var sql = 'select lid from game_mj_rooms where code=?';
	pomelo.app.get('db').query(sql, [code], function(r){
		if (!r || r.length == 0) return;
		var lid = r[0].lid;

		var sql = 'update log_create_rooms set state=?,endtime=? where lid=?';
		pomelo.app.get('db').query(sql, [state, Math.round(+new Date() / 1000), lid]);

		var sql = 'delete from game_mj_rooms where code=?';
		pomelo.app.get('db').query(sql, [code]);
	});
	if (cb) cb();
};
//游戏服务器关闭时清理房间
dbm.removeRooms = function (gsid, cb) {
	pomelo.app.get('db').query('delete from game_mj_rooms where gsid=?', [gsid]);
	if (cb) cb();
};

//加卡
dbm.addRoomCards = function(uid, num, reasonno, reason, gameid, code, cb) {
	pomelo.app.get('db').query('call addroomcards(?,?,?,?,?,?);', [gameid||0, uid, num, reasonno, reason, code||0], function(result) {
		//log.warn('addRoomCards', uid, num, reasonno, reason, gameid, code, result);
		if (result && result[0]) cb(result[0][0]); else cb(null);
	});
};
//加礼券
dbm.addTickets = function(uid, num, reasonno, reason, gameid, cb) {
	pomelo.app.get('db').query('call addtickets(?,?,?,?,?);', [gameid||0, uid, num, reasonno, reason], function(result) {
		//log.warn('addTicket', uid, num, reasonno, reason, gameid, result);
		if (result && result[0]) cb(result[0][0]); else cb(null);
	});
};
//查询用户信息
dbm.getUser = function(uid, cb) {
	var sql = "select * from yly_member inner join game_userfield using(uid) where uid=" + uid;
	pomelo.app.get('db').q_first(sql).done(cb);
};
//查询用户流水
dbm.getUserLiushui = function(ldate, uid, cb){
	var sql = "select * from log_user_liushui where ldate=? and uid=?";
	pomelo.app.get('db').q_first(sql, [ldate, uid]).then(function (r) { return r; }).done(cb);
}
//配置
dbm.getGameConfig = function(id, cb) {
	var sql = "select cvalue from game_config where cid=" + id;
	pomelo.app.get('db').q_first(sql).then(function(r){ return r && r.cvalue ? parseInt(r.cvalue) || 0 : 0 }).done(cb);
};
dbm.getClub = function(uid, cb) {
	var sql = 'select * from p2p_club where guid = ' + uid;
	pomelo.app.get('db').q_first(sql).then(function(r){ return r; }).done(cb);
};
dbm.addCPStones = function(puid,cpid,type,num,uid,code,cb){
	pomelo.app.get('db').query('call addCPStones(?,?,?,?,?,?);', [puid,cpid,type,num,uid,code], function(result) {
		if (result && result[0]) cb(result[0][0]); else cb(null);
	});
}
dbm.getCPMember = function(uid,cpid,cb){
	var sql = 'select * from p2p_cp_member where uid = ? and cpid = ? and state = 1';
	pomelo.app.get('db').q_first(sql, [uid, cpid]).then(function(r){ return r; }).done(cb);
}
dbm.getClubMember = function(uid,clubid,cb){
	var sql = 'select * from p2p_club_member as a inner join p2p_club as b on a.guid = b.guid where a.uid = ? and b.puid = ? and a.state = 1';
	pomelo.app.get('db').q_first(sql, [uid, clubid]).then(function(r){ return r; }).done(cb);
}
dbm.getCompartment = function(cpid,cb){
	var sql = 'select * from p2p_compartment where id = ?';
	pomelo.app.get('db').q_first(sql, [cpid]).then(function(r){ return r; }).done(cb);
}
dbm.getClubById = function(clubid, cb) {
    var sql = 'select * from p2p_club where puid = ' + clubid;
    pomelo.app.get('db').q_first(sql).then(function(r){ return r; }).done(cb);
}

//vip系统
//更改用户信息
dbm.updateUser = function(uid, level, experience, cb){
	pomelo.app.get('db').query('update game_userfield set level = ?,experience = experience + ? where uid = ?', [level, experience, uid]);
	if (cb) cb();
};

//记录普通升级信息
dbm.logUserLevel = function(uid, level, cb) {
    var ltime = Math.round(+new Date() / 1000);
    var sql = 'insert into log_user_level(uid, level, ltime) values('+uid+','+level+','+ltime+')';
    pomelo.app.get('db').newQuery(sql);
    if (cb) cb();
}
//增加玩家道具
dbm.addUserProp = function(uid, pid, gstate, gtimelen, cb){
	pomelo.app.get('db').q_first('call adduserprops(?,?,?,?,@ret)', [uid, pid, gstate, gtimelen]).then(function(r){return r;}).done(cb);
};
dbm.getGameLevel = function(cb){
	pomelo.app.get('db').q_query('select * from game_level').then(function(r){return r;}).done(cb);
};
dbm.getUserProp = function(uid,pid,cb){
	pomelo.app.get('db').q_first('select pid,expire,remain from user_props where uid = ? and pid = ?',[uid,pid]).then(function(r){return r;}).done(cb);
};
dbm.addUserRound = function(uid,cb){
	pomelo.app.get('db').query('update game_userfield set vip_rounds = vip_rounds + 1 where uid = ?', [uid]);
	if (cb) cb();
};
dbm.getUserProps = function(uid,cb){
	pomelo.app.get('db').q_query('select * from user_props where uid = ' + uid).then(function(r){return r;}).done(cb);
};
dbm.getGameProps = function(cb){
	pomelo.app.get('db').q_query('select * from game_props').then(function(r){return r;}).done(cb);
};
dbm.getVipConfig = function(cb){
	pomelo.app.get('db').q_query('select * from game_vip_level').then(function(r){return r;}).done(cb);
};
dbm.updateVip = function(uid,vip_level,vip_card,vip_day,cb){
	var unix = Math.round(+new Date() / 1000);
	var vip_expire = parseInt(new Date(new Date().toLocaleDateString()).getTime()/1000) + (parseInt(vip_day)+1) * 86400;
	pomelo.app.get('db').query('update game_userfield set vip_level = ?, vip_card = vip_card - ?, vip_time = ?,vip_expire = ?,vip_rounds = 0,vip_lstate = 1,vip_ltime = ? where uid = ?',
			[vip_level,vip_card,unix,vip_expire,unix,uid]);
	if (cb) cb();
};
//表情管理
dbm.getGameEmojis = function(cb){
    pomelo.app.get('db').q_query('select * from game_emojis').then(function(r){return r;}).done(cb);
};
dbm.getUserEmoji = function(uid,eid,cb){
    pomelo.app.get('db').q_first('select * from user_emojis where uid = ? and eid = ?',[uid,eid]).then(function(r){return r;}).done(cb);
};
dbm.addUserEmoji = function(uid, eid, state, buy_state, gstate, gtimelen, cb){
    log.warn('addUserEmoji', uid, eid);
    pomelo.app.get('db').q_first('call adduseremojis(?,?,?,?,?,?,@ret)', [uid, eid, state, buy_state, gstate, gtimelen]).then(function(r){return r;}).done(cb);
};
dbm.getUserEmojis = function(uid,cb){
    pomelo.app.get('db').q_query('select * from user_emojis where uid = ' + uid).then(function(r){return r;}).done(cb);
};
dbm.getMatchConfig = function (cb) {
	var unix = Math.round(+new Date() / 1000);
	var date = parseInt((new Date()).format('yyyyMMdd'));
	var sql = "select *,ifnull((select mlid from match_mlid where mid = game_match_config.mid),0) mlid"
	sql += " from game_match_config where ((ntype=4 and status=1 and enddate>="+date+") or (ntype=3 and endtime > "+unix+") or ntype = 2) order by starttime desc";
	pomelo.app.get('db').q_query(sql).then(function(r){
		var matchs = {};
		for(var i = 0,len = r.length; i<len; i++) {
			r[i].game = JSON.parse(r[i].game);
			r[i].award = JSON.parse(r[i].award);
			matchs[r[i].mid] = r[i];
		}
		return matchs;
	}).done(cb);
};

dbm.getUserMatchScore = function(mid, mlid, uid, cb) {
	var sql = "select score from user_match_score where mid=? and uid=? and mlid = ?";
	pomelo.app.get('db').q_first(sql, [mid, uid, mlid]).then(function(r){ return r; }).done(cb);
};
dbm.matchSign = function(uid, mid, mlid, cb){
	var ltime = Math.round(+new Date() / 1000);
	var sql = 'insert into log_match_sign (uid,mid,mlid,ltime) value (?,?,?,?)';
	pomelo.app.get('db').query(sql, [uid, mid, mlid, ltime], function(result) {
		if (cb) cb(result && result.insertId ? parseInt(result.insertId) : 0);
	});
}
dbm.updateMatchSign = function(uid, mid, mlid, state, cb){
	var sql = "update log_match_sign set state = ? where uid = ? and mid = ? and mlid = ?";
	pomelo.app.get('db').query(sql, [state, uid, mid, mlid]);
	if (cb) cb();
}
dbm.getMatchSignTimes = function(uid,mid,cb){
	var time = new Date(new Date().setHours(0, 0, 0, 0)) / 1000;
	var sql = "select count(1) total from log_match_sign where uid = ? and mid = ? and ltime >= ? and state in (0,3)";
	pomelo.app.get('db').query(sql, [uid, mid, time], function(result) {;if (cb) cb(result && result[0] && result[0].total ? parseInt(result[0].total) : 0);});
}
dbm.matchmlid = function(mid,cb){
	pomelo.app.get('db').query('call match_mlid(?);', [mid], function(result) {
		if (result && result[0]) cb(result[0][0]); else cb(null);
	});
}
dbm.getCSMatchSign = function(uid,mid,cb){
	var sql = "select uid,state from match_cs_user where uid=? and mid=?";
	pomelo.app.get('db').q_first(sql, [uid,mid]).then(function(r){return r; }).done(cb);
}
dbm.updateCSMatchSign = function(uid,mid,cb){
	var sql = "update match_cs_user set state = 3 where uid = ? and mid = ?";
	pomelo.app.get('db').query(sql, [uid, mid]);
	if (cb) cb();
}
dbm.getMotors = function(num,cb){
	var sql = "select * from yly_motor as a inner join yly_member as b on a.uid = b.uid inner join game_userfield as c on a.uid = c.uid and a.state = 0 order by uid desc limit ?";
	pomelo.app.get('db').q_query(sql,[num]).then(function(r){return r;}).done(cb);
}
dbm.updateMotor = function(uids,cb){
	var sql = "update yly_motor set state = 1 where uid in ("+ uids.join(',') +")";
	pomelo.app.get('db').query(sql);
	if (cb) cb();
}
dbm.removeMatchRooms = function (gsid, tid, cb) {
	var sql = 'select lid from game_mj_rooms where gsid=? and tid=?';
	pomelo.app.get('db').query(sql, [gsid,tid], function(r){
		if (!r || r.length == 0) return;
		var lid = r[0].lid;

		var sql = 'update log_create_rooms set state=1,endtime=? where lid=?';
		pomelo.app.get('db').query(sql, [Math.round(+new Date() / 1000), lid]);

		var sql = 'delete from game_mj_rooms where gsid=? and tid=?';
		pomelo.app.get('db').query(sql, [gsid,tid]);
	});
	if (cb) cb();
};
dbm.getRuningRoomByCode = function(code, cb) {
    var sql = "select * from  game_mj_rooms  where code=" + code;
    pomelo.app.get('db').q_first(sql).done(cb);
}

//金币场
dbm.addUserGolds = function(gid,uid,golds,reason,reasonno,cb) {
	pomelo.app.get('db').query('call addbonusgolds(?,?,?,?,?);', [gid||0, uid, golds, reasonno, reason], function(result) {
		if (result && result[0]) cb(result[0][0]); else cb(null);
	});
};
//创建金币房间
dbm.createGoldRooms = function (obj, cb) {
    obj.ltime = Math.round(+new Date() / 1000);
    var sql = 'insert into log_gold_rooms set ?';
    pomelo.app.get('db').query(sql, obj, function(result){
        if (cb) cb(result && result.insertId ? result.insertId : 0);
    });
};
//房间结束
dbm.removeGoldRooms = function (lid, state, cb) {
    var etime = Math.round(+new Date() / 1000);
    var sql = 'update log_gold_rooms set state = ?, etime = ? where lid = ?';
    pomelo.app.get('db').query(sql, [state, etime, lid]);
    if (cb) cb();
};
//金币掉落日志
dbm.goldsDropLog = function(uid,redpack,gid,rtype,ridx,state,cb){
	var unix = Math.round(+new Date() / 1000);
	var sql = 'insert into log_golds_redpack(uid,redpack,gid,rtype,ridx,state,ltime)value(?,?,?,?,?,?,?)';
	pomelo.app.get('db').query(sql,[uid,redpack,gid,rtype,ridx,state,unix]);
	if(cb) cb();
}

//获取活动配置
dbm.getActivityConfig = function (acid, cb) {
	pomelo.app.get('db').q_query('select * from activity_config where ac_id = ' + acid).then(function (r) { return r; }).done(cb);
}

dbm.matchYQRank = function(mid,date,cb){
	var sql = 'call crontab_match_yqrank(?,?)';
	pomelo.app.get('db').query(sql, [mid,date]);
	if (cb) cb();
};

dbm.getYQSign = function(uid,mid,date,cb){
	var sql = 'select *,ifnull((select count(1) from match_yq_user where mid = a.mid and date = a.date),0) total from match_yq_user a where a.uid = ? and a.mid = ? and a.date = ?';
	pomelo.app.get('db').q_first(sql, [uid,mid,date]).then(function(r){ return r; }).done(cb);
};

module.exports = {
	name: "hall",
	beans: [{
		id: "DBManager",
		func: DBManager,
		scope: "singleton"
	}]
};