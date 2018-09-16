extends Node

var reqId = 0
var reqs = {}
var headers

func _ready():
	set_process(true)
	
func _process(d):
	for key in reqs.keys():
		var req = reqs[key]
		req.err = req.http.request(HTTPClient.METHOD_GET, req.path,req.headers) # Request a page from the site (this one was chunked..)
		assert(req.err == OK) # Make sure all is OK
		
		while req.http.get_status() == HTTPClient.STATUS_REQUESTING:
		# Keep polling until the request is going on
			req.http.poll()
			print("Requesting..")
			OS.delay_msec(500)
		
		assert(req.http.get_status() == HTTPClient.STATUS_BODY or req.http.get_status() == HTTPClient.STATUS_CONNECTED) # Make sure request finished well.
		
		print("response? ", req.http.has_response()) # Site might not have a response.
		if req.http.has_response():
# If there is a response..

			headers = req.http.get_response_headers_as_dictionary() # Get response headers
			print("code: ", req.http.get_response_code()) # Show response code
			print("**headers:\\n", headers) # Show headers
			
			# Getting the HTTP Body
			
			if req.http.is_response_chunked():
				# Does it use chunks?
				print("Response is Chunked!")
			else:
			# Or just plain Content-Length
				var bl = req.http.get_response_body_length()
				print("Response Length: ",bl)
			
			# This method works for both anyway
			
			while req.http.get_status() == HTTPClient.STATUS_BODY:
			# While there is body left to be read
				req.http.poll()
				var chunk = req.http.read_response_body_chunk() # Get a chunk
				if chunk.size() == 0:
				# Got nothing, wait for buffers to fill a bit
					OS.delay_usec(1000)
				else:
					req.rb = req.rb + chunk # Append to read buffer
		else:
			req.err = "no right response"	
			
		# Done!
		if req.err != OK:
			print('http err:',req.err)
		else:
			if req.isRaw:
				req.cb.call_func(req.rb)
			else:
				req.cb.call_func(req.rb.get_string_from_ascii())	
		reqs.erase(key)
		print('cur http reqs size:',reqs.size())

#		if req.state == 1:
#			if req.http.get_status()==HTTPClient.STATUS_CONNECTING or req.http.get_status()==HTTPClient.STATUS_RESOLVING:
#				req.http.poll()
#			else:
#				if req.http.get_status() != HTTPClient.STATUS_CONNECTED:
#					req.state = 4
#					req.err = 'err when connecting.'
#				else:
#					req.err = req.http.request(HTTPClient.METHOD_POST,req.path,req.headers)
#					if req.err == OK:
#						req.state = 2
#					else:
#						req.state = 4
#		elif req.state == 2:
#			if req.http.get_status() == HTTPClient.STATUS_REQUESTING:
#				req.http.poll()
#			else:
#				if req.http.get_status() != HTTPClient.STATUS_BODY and req.http.get_status() != HTTPClient.STATUS_CONNECTED:
#					req.state = 4
#					req.err = 'err when request.'
#				else:
#					if req.http.has_response():
#						req.state = 3
#					else:
#						req.state = 4
#		elif req.state == 3:
#			if req.http.get_status()==HTTPClient.STATUS_BODY:
#				req.http.poll()
#				var chunk = req.http.read_response_body_chunk()
#				if chunk.size()==0:
#					pass
#				else:
#					req.rb = req.rb + chunk
#			else:
#				req.state = 4
#		else:
#			if req.err != OK:
#				print('http err:',req.err)
#			else:
#				if req.isRaw:
#					req.cb.call_func(req.rb)
#				else:
#					req.cb.call_func(req.rb.get_string_from_ascii())
#			reqs.erase(key)
#			print('cur http reqs size:',reqs.size())

func post(host,port,path,msg,cb,isRaw = false):
	var http = HTTPClient.new()
	var err = http.connect_to_host(host,port)
	assert(err == OK)
	 # Wait until resolved and connected
	while http.get_status() == HTTPClient.STATUS_CONNECTING or http.get_status() == HTTPClient.STATUS_RESOLVING:
       http.poll()
       print("Connecting..")
       OS.delay_msec(500)

	assert(http.get_status() == HTTPClient.STATUS_CONNECTED) # Could not connect
	msg = to_json(msg)
	var f = FuncRef.new()
	f.set_instance(cb.instance)
	f.set_function(cb.f)
	var headers=[
	"User-Agent: Pirulo/1.0 (Godot)",
	"Accept: */*",
	"Content-Type:application/x-www-form-urlencoded"
	]
	reqId += 1
	
	var state = 1
	if err != OK:
		state = 4
	
	reqs[reqId] = {
		http=http,
		state = state,
		msg = msg,
		cb = f,
		path = path,
		err = err,
		headers = headers,
		isRaw = isRaw,
		rb = PoolByteArray()
	}

