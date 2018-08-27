var tools = require('../gameutils/Tools');
var logger = require('pomelo-logger').getLogger("db", 'DB');
var mysql = require('mysql');

var sqlobj = {};

function init(app) {
	var mysqlConfig = app.get('mysql');
	sqlobj.pool = mysql.createPool({
		'host': mysqlConfig.host,
		'port': mysqlConfig.port,
		'user': mysqlConfig.user,
		'password': mysqlConfig.password,
		'database': mysqlConfig.database,
		'connectionLimit': mysqlConfig.maxconnections
	});
}

//添加数据
function inserttablem($tablename, $insertsqlarr, $returnid, $replace, $cb) {
	var newarg = tools.slice_argu(arguments, 0);

	if (tools.isFunction($returnid)) {
		$cb = $returnid;
		$returnid = false;
	}
	if (tools.isFunction($replace)) {
		$cb = $replace;
		$replace = false;
	}

	var $insertkeysql = '',
		$insertvaluesql = '',
		$comma = '';
	for (var $insert_key in $insertsqlarr) {
		var $insert_value = $insertsqlarr[$insert_key];
		$insertkeysql += $comma + '`' + $insert_key + '`';
		$insertvaluesql += $comma + mysql.escape($insert_value);
		$comma = ', ';
	}
	$method = $replace ? 'REPLACE' : 'INSERT';

	var callback = function(result) {
		var arg = tools.slice_argu(arguments, 1);
		if ($returnid && !$replace) {
			arg.unshift(result.insertId);
		} else if ($cb) {
			arg.unshift(null);
		}
		if ($cb) $cb.apply(null, arg);
	};

	var querystr = $method + ' INTO ' + $tablename + ' (' + $insertkeysql + ') VALUES (' + $insertvaluesql + ')';
	var arg = [querystr, callback];

	if (newarg.indexOf($cb) >= 0 && newarg.length > (newarg.indexOf($cb) + 1)) {
		arg = arg.concat(newarg.slice((newarg.indexOf($cb) + 1)));
	}
	newQuery.apply(null, arg);
}
//更新数据
function updatetablem($tablename, $setsqlarr, $wheresqlarr, $cb) {
	var $setsql = '',
		$comma = '';
	for (var $set_key in $setsqlarr) {
		var $set_value = $setsqlarr[$set_key];
		$setsql += $comma + '`' + $set_key + '`' + "=" + mysql.escape($set_value);
		$comma = ',';
	}
	var $where = '',
		$comma = '';
	if (tools.isEmpty($wheresqlarr)) {
		$where = '1';
	} else if (tools.isString($wheresqlarr)) {
		$where = $wheresqlarr;
	} else {
		for (var $key in $wheresqlarr) {
			var $value = $wheresqlarr[$key];
			$where += $comma + '`' + $key + '`' + "=" + mysql.escape($value);
			$comma = ' AND ';
		}
	}
	var callback = function(result) {
		if ($cb) $cb.apply(null, [result].concat(tools.slice_argu(arguments, 1)));
	};
	var querystr = 'UPDATE ' + $tablename + ' SET ' + $setsql + ' WHERE ' + $where;
	var arg = [querystr, callback];
	if (arguments.length > 4) {
		arg = arg.concat(tools.slice_argu(arguments, 4));
	}
	newQuery.apply(null, arg);
}
//删除
function deletetablem($tablename, $wheresqlarr, $cb) {
	var $where = '',
		$comma = '';
	if (tools.isEmpty($wheresqlarr)) {
		$where = '1';
	} else if (tools.isString($wheresqlarr)) {
		$where = $wheresqlarr;
	} else {
		for (var $key in $wheresqlarr) {
			var $value = $wheresqlarr[$key];
			$where += $comma + '`' + $key + '`' + "=" + mysql.escape($value);
			$comma = ' AND ';
		}
	}
	var callback = function(result) {
		if ($cb) $cb.apply(null, [result].concat(tools.slice_argu(arguments, 1)));
	};
	var querystr = 'DELETE FROM ' + $tablename + ' WHERE ' + $where;
	var arg = [querystr, callback];
	if (arguments.length > 3) {
		arg = arg.concat(tools.slice_argu(arguments, 3));
	}
	newQuery.apply(null, arg);
}
//取第一条记录
function fetch_first($sql, $cb) {
	if ($sql.toLowerCase().indexOf("limit") < 0) {
		$sql += " limit 1";
	}
	var callback = function(result) {
		if ($cb) {
			if (tools.isArray(result) && result.length > 0) {
				$cb.apply(null, [result[0]].concat(tools.slice_argu(arguments, 1)));
			} else {
				$cb.apply(null, [null].concat(tools.slice_argu(arguments, 1)));
			}
		}
	};
	var arg = [$sql, callback].concat(tools.slice_argu(arguments, 2));
	newQuery.apply(null, arg);
}
//结果唯一值
function result_first($sql, $cb) {
	var callback = function(result) {
		if ($cb) {
			if (tools.isArray(result) && result.length > 0) {
				if (tools.isObject(result[0])) {
					for (var k in result[0]) {
						var arg = [result[0][k]].concat(tools.slice_argu(arguments, 1));
						$cb.apply(null, arg);
						break;
					}
				} else {
					$cb.apply(null, [result[0]].concat(tools.slice_argu(arguments, 1)));
				}
			} else {
				$cb.apply(null, [null].concat(tools.slice_argu(arguments, 1)));
			}

		}
	};
	var arg = [$sql, callback].concat(tools.slice_argu(arguments, 2));
	newQuery.apply(null, arg);
}
//执行sql
function newQuery(sqlString, onComplete) {
	var arg = null;
	var caller = newQuery.caller;
	if (arguments.length > 2) {
		arg = tools.slice_argu(arguments, 2);
	}
	sqlobj.pool.query(sqlString, function(err, rows) {
		if (onComplete) {
			if (arg != null) {
				arg.unshift(rows);
				onComplete.apply(null, arg);

			} else {
				onComplete(rows);
			}
			caller = null;

		}
		if (err) {
			logger.error(err);
			logger.error(sqlString);
		}
	});
}
function query(sqlString, param, onComplete) {
	sqlobj.pool.query(sqlString, param, function(err, rows) {
		if (onComplete) onComplete(rows);
		if (err) {
			logger.error(err);
			logger.error(sqlString);
		}
	});
}
//Promise 查询
function q_query(sql, params, cb) {
	return new Promise(function(resolve, reject) {
		sqlobj.pool.query(sql, params, function(err, result) {
			if (err) logger.error(err);
			resolve(result);
		});
	});
}
//Promise 查询第一条记录
function q_first(sql, params, cb) {
	return new Promise(function(resolve, reject) {
		sqlobj.pool.query(sql, params, function(err, result) {
			if (err) logger.error(err);
			resolve(result ? result[0] : null);
		});
	});
}
//getConnection
function getConnection(cb) {
	sqlobj.pool.getConnection(cb);
}
//releaseConnection
function releaseConnection(conn) {
	conn.release();
}

// mysql CRUD
var sqlclient = module.exports;
var Promise = require("bluebird");

//init
sqlclient.init = function(app) {
	if (!!sqlobj.pool) {
		return sqlclient;
	} else {
		init(app);
		sqlclient.inserttablem = inserttablem;
		sqlclient.updatetablem = updatetablem;
		sqlclient.deletetablem = deletetablem;
		sqlclient.fetch_first = fetch_first;
		sqlclient.result_first = result_first;
		sqlclient.newQuery = newQuery;
		sqlclient.getConnection = getConnection;
		sqlclient.query = query;

		sqlclient.q_query = q_query;
		sqlclient.q_first = q_first;
		return sqlclient;
	}
};

//shutdown database
sqlclient.shutdown = function(app) {
	//mysql.destroyAllNow();
	//没找到方法关闭所有连接
};