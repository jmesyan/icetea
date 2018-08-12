if reconnect.isreconnect && reconnect.reconnectAttempts < reconnect.reconnectMaxAttempts {
                env.die = make(chan bool)
                reconnect.reconnectAttempts++
                logger.Println(fmt.Printf("begin the %d times reconnect", reconnect.reconnectAttempts))
                time.AfterFunc(reconnect.reconnectionDelay, func() {
                    logger.Println(fmt.Printf("begin the %d times reconnect", reconnect.reconnectAttempts))
                    connect(reconnect.addr，reconnect.opts...)
                })
                // time.Sleep(reconnect.reconnectionDelay)
                reconnect.reconnectionDelay *= 2
                break
            }