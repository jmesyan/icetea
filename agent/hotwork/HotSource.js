var tools = require("../../app/GameUtils/Tools");

function scanFolder(path) {
	require("./Watcher").watch(path, scanCallBack, true);
}

var hotmap = {};
var file_bean_sort = {};

function scanCallBack(folderres, scan) {
	for (var file in folderres) {
		var res = folderres[file];

		if (typeof res == "function") {
			var bean = {
				func: res
			};
			var tmpobj = new res();
			if (tmpobj.hasOwnProperty("$id")) {
				bean.id = tmpobj.$id;
			}

			if (!bean.id) {
				bean.id = file;
			}

			if ((!!file_bean_sort[bean.id]) && scan != true) {
				if (file_bean_sort[bean.id] != file) {
					throw new Error("Duplcate ID with files:" + file + " and " + file_bean_sort[bean.id]);
					return;
				}
			} else {
				file_bean_sort[bean.id] = file;
			}
			var singleton = (tmpobj.hasOwnProperty("$scope") && tmpobj.$scope == "singleton");

			if (!!hotmap[bean.id]) {
				if (scan) return;
				if (singleton != (!!hotmap[bean.id].singleton)) {
					throw new Error("singleton has changed in :" + file + "_" + bean.id);
					return;
				}
				var protos = null;
				//单例模式，尝试改变func试试看
				var org_func = hotmap[bean.id].func;
				if (!!org_func) {
					var orgprotos = org_func.prototype;
				} else if (!!hotmap[bean.id].singleton) {
					var orgprotos = hotmap[bean.id].singleton.__proto__;
				} else {
					continue;
				}

				protos = bean.func.prototype;
				try {
					if (!!protos) {
						for (var func_name in protos) {
							orgprotos[func_name] = protos[func_name];
						}
					}
					console.log("file : {0} id: {1}  success update!".format(file, bean.id))
					//console.log(hotmap[bean.id]);
				} catch (e) {
					console.error("file : {0} id: {1}  fail!!!! update!".format(file, bean.id))
					//console.error(hotmap[bean.id]);
					console.error(e);
				}
			} else {
				hotmap[bean.id] = {
					id: bean.id,
					func: bean.func
				};

				if (singleton) {
					hotmap[bean.id].singleton = tmpobj;
				}
				//console.log(JSON.stringify(hotmap[bean.id]));
			}
		} else if (res.hasOwnProperty("beans")) {
			//按照规矩来的想要热更新的
			for (var i = 0; i < res.beans.length; i++) {

				var bean = res.beans[i];
				//不存在bean id的定义
				if (!bean.id) {
					throw new Error("file:" + file + ",has no bean id!");
					return;
				}
				if (!bean.func) {
					throw new Error("file:" + file + ",has no bean func!");
					return;
				}
				if ((!!file_bean_sort[bean.id]) && scan != true) {
					if (file_bean_sort[bean.id] != file&&res.beans.length==1) {
						throw new Error("Duplcate ID with files:" + file + " and " + file_bean_sort[bean.id]);
						return;
					}
				} else {
					file_bean_sort[bean.id] = file;
				}
				//是否单例
				var singleton = (bean.hasOwnProperty("scope") && (bean.scope == "singleton"));

				if (!!hotmap[bean.id]) {
					//这种是独立文件已经被加载过，不要浪费细胞去更新了
					if (scan) return;
					//这里是更新逻辑
					if (singleton != (!!hotmap[bean.id].singleton)) {
						throw new Error("singleton has changed in :" + file + "_" + bean.id);
						return;
					}
					var protos = null;
					//单例模式，尝试改变func试试看
					var org_func = hotmap[bean.id].func;
					if (!!org_func) {
						var orgprotos = org_func.prototype;
					} else if (!!hotmap[bean.id].singleton) {
						var orgprotos = hotmap[bean.id].singleton.__proto__;
					} else {
						continue;
					}

					protos = bean.func.prototype;
					try {
						if (!!protos) {
							for (var func_name in protos) {
								orgprotos[func_name] = protos[func_name];
							}
						}
						console.log("file : {0} id: {1}  success update!".format(file, bean.id))
						//console.log(hotmap[bean.id]);
					} catch (e) {
						console.error("file : {0} id: {1}".format(file, bean.id))
						//console.error(hotmap[bean.id]);
						console.error(e);
					}
					//更新的时候运行，比如触发某些操作,只有单例可以这样做
					if (singleton && bean.hasOwnProperty("runupdate")) {
						hotmap[bean.id].singleton[bean.runupdate]();
					}
				} else {
					hotmap[bean.id] = {
						id: bean.id,
						func: bean.func
					};
					if (singleton) {
						hotmap[bean.id].singleton = new bean.func();
					}
				}
			}
		} else {
			//非标，可能只是一个定义的数据，默认我们用文件名做id，规则是覆盖原有数据
			if (!!hotmap[file]) {
				if (scan) return;
				//不需要更新
				if (!!res.noUpdate) return;
				//反转,注意只有单层纯数据对象定义库适用此功能
				if (!!res.reverse) {
					var org_res = hotmap[file].singleton;
					for (var key in res) {
						if (org_res.hasOwnProperty(key)) {
							res[key] = org_res[key];
						} else {
							org_res[key] = res[key];
						}
					}
					return;
				}

				if (!hotmap[file].singleton) {
					throw new Error("no data in hot file:" + file);
				}
				//深度copy，无论多少层，都覆盖
				tools.extend(true, hotmap[file].singleton, res);
			} else {
				hotmap[file] = {
					id: file,
					singleton: res
				};
			}
		}
	}
}
exports.scanFolder = scanFolder;
exports.setHot=function (id,require,file) {
	file_bean_sort[id] = file;
}
exports.getHot = function(id, require, file) {
	if (!hotmap.hasOwnProperty(id)) {
		if (!file) file = id;
		/**
		 * 不存在，这个时候就比较狗血了，应该是新添加的引用需求
		 * 我们应该这里执行cb呢还是寻求其他剞劂方案
		 */
		if (!!require) {
			var res = {};
			res[file] = require;
			scanCallBack(res, true);

		} else {
			throw new Error("no hot file " + id + " no path");
		}
	}
	if (!hotmap.hasOwnProperty(id)) {
		throw new Error("no hot file :" + id);
	}
	var hot = hotmap[id];

	if (!!hot.singleton) {
		return hot.singleton;
	}
	return hot.func;
};