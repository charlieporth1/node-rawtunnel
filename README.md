node-rawtunnel
====
ssh -R without encryption. Raw TCP tunneling by node.js.


Usage
====

SSH:

~~~
ssh -R 60000:localhost:60000 -R 60001:localhost:60001
~~~

node-rawtunnel:

On sshd (server) side,

~~~
node ./server.js PASSCODE
~~~

On ssh (client) side,

~~~
node ./client.js -R 60000:localhost:60000 -R 60001:localhost:60001 -p PASSCODE
~~~



LICENSE
====
MIT

