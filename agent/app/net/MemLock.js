var MemLock = {
	cache: {},

	start: function(key, lifetime) {
		lifetime = lifetime || 10;
		var now = Math.round(+new Date() / 1000);
		if (MemLock.cache[key] && (MemLock.cache[key] + lifetime > now)) return true;
		MemLock.cache[key] = now;
		return false;
	},
	end: function(key) {
		delete MemLock.cache[key];
	}
};

module.exports = MemLock;