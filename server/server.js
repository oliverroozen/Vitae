"use strict";
console.log('Server initializing...');

const express = require('express');
const responseTime = require('response-time');
const mysql = require('mysql');
const WebSocket = require('ws');
const http = require('http');
const uuidv4 = require('uuid/v4');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer();

const sessionParser = session({
  saveUninitialized: false,
  secret: '$eCuRiTy',
  resave: false
});

const wss = new WebSocket.Server({
  verifyClient: (info, done) => {
    console.log('Parsing session from request...');
    sessionParser(info.req, {}, () => {
      console.log('Session is parsed!');
      // We can reject the connection by returning false to done(). For example, reject here if user is unknown.
      done(info.req.session.userId);
    });
  },server});

var sql = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    dateStrings: true, // Note, when mysql date fields are returned, they are auto-converted by Node from objects into strings using the wrong date function. This converts them before this.
    multipleStatements: true
});

var websocketUsers = {}; // Depreciated

server.on('request', app);

app.set('title', 'Revision Manager');
app.set('views', 'site/views');
app.set('view engine', 'pug');

app.use(express.static('site/static'));
app.use(express.static('site/content'));
app.use(responseTime({digits:0, suffix:false}));
app.use(bodyParser.json());
app.use(sessionParser);

sql.connect((err)=>{
    if (err) {
        console.log('Error connecting to SQL database: ' + err.stack);
    } else {
        sql.query('CREATE DATABASE IF NOT EXISTS Vitae',(err)=>{
			sql.changeUser({database : 'Vitae'}, function(err) {if (err) throw err;});
			sql.query(`CREATE TABLE IF NOT EXISTS schools (
				schoolID SMALLINT NOT NULL AUTO_INCREMENT,
				nzqaNum SMALLINT NOT NULL,
				title VARCHAR(64) NOT NULL,
				location VARCHAR(255) NOT NULL,
				PRIMARY KEY (schoolID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			sql.query(`CREATE TABLE IF NOT EXISTS users (
				userID INT NOT NULL AUTO_INCREMENT,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
				accountType CHAR(4) NOT NULL,
				schoolID SMALLINT NOT NULL,
				nzqaNum INT NOT NULL,
				fullName VARCHAR(64) NOT NULL,
				yearLevel TINYINT NOT NULL,
				bio VARCHAR(256) NOT NULL,
				PRIMARY KEY (userID),
				FOREIGN KEY (schoolID) REFERENCES schools(schoolID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			sql.query(`CREATE TABLE IF NOT EXISTS posts (
				postID INT NOT NULL AUTO_INCREMENT,
                postUUID VARCHAR(36) UNIQUE NOT NULL,
				postType CHAR(4) NOT NULL,
				userID INT NOT NULL,
				postTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
				privacyLevel TINYINT NOT NULL,
				description VARCHAR(255),
				youTubeURL VARCHAR(11),
				PRIMARY KEY (postID),
				FOREIGN KEY (userID) REFERENCES users(userID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			sql.query(`CREATE TABLE IF NOT EXISTS comments (
				commentID INT NOT NULL AUTO_INCREMENT,
                commentUUID VARCHAR(36) UNIQUE NOT NULL,
				postID INT NOT NULL,
				postTime DATETIME DEFAULT CURRENT_TIMESTAMP(),
				content VARCHAR(256) NOT NULL,
				PRIMARY KEY (commentID),
				FOREIGN KEY (postID) REFERENCES posts(postID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			sql.query(`CREATE TABLE IF NOT EXISTS sessions (
				sessionID INT NOT NULL AUTO_INCREMENT,
				sessionUUID VARCHAR(36)	NOT NULL,
				sessionCreation DATETIME NOT NULL,
				userID INT NOT NULL,
				PRIMARY KEY (sessionID),
				FOREIGN KEY (userID) REFERENCES users(userID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
//			sql.query(`CREATE TRIGGER setuuid
//				BEFORE INSERT ON assessments
//				FOR EACH ROW
//					IF new.assessmentID IS NULL
//					THEN
//						SET new.assessmentID = UUID_SHORT();
//				END IF;
//			`, (err)=>{
//				if (err) {
//					if (err.errno != 1359) {console.log(err)} else {console.log('Caught error on create trigger.')};
//				};
//			});
			console.log('Connected to database...');
			
			// ----------------- Inserting test data ---------------------
			sql.query('SELECT userID FROM users',(error,results,fields)=>{
				if (error) throw error;
				if (results.length == 0) {
					insertTestUserData();
				}
			});

			server.listen(2001,()=>{
				console.log('Online on port 2001!');
			});
		});
    }
});

app.get('/', function (req, res) {
	console.log(req.session.userID);
	
	sql.query('SELECT userID FROM sessions WHERE sessionUUID = ? AND sessionCreation < (NOW()-1)', [req.session.userID],(error,results,fields)=>{
		if (error) throw error;
		
		console.log('Rendering index. Results: ' + results);
		
		if (results.length == 0) {
			res.redirect('login');
		} else {
			res.render('index', {randVer: Math.round(Math.random()*1000)});
			console.log(`index served to ${req.ip} in ${res.getHeader("X-Response-Time")}ms`);
		}
	});
});

app.get('/login', function (req, res) {
	sql.query('SELECT userID FROM sessions WHERE sessionUUID = ? AND sessionCreation < (NOW()-1)', [req.session.userID],(error,results,fields)=>{
		if (error) throw error;
		
		if (results.length != 0) {
			res.redirect('/');
		} else {
			res.render('login', {randVer: Math.round(Math.random()*1000)});
			console.log(`login served to ${req.ip} in ${res.getHeader("X-Response-Time")}ms`);
		}
	});
});

app.post('/validate', function (req, res) {
    console.log(req.body);
    
    sql.query('SELECT userID FROM users WHERE username = ? AND password = ?', [req.body.username,req.body.password],(error,results,fields)=>{
        if (error) throw error;
		
		console.log(JSON.stringify(results));

        if (results.length == 0) {
            // Send response to let client know server handled successfully, but with no returns
            console.log('Details are invalid.');
            res.json({result:'FAIL',message:'Details are invalid.'});
        } else {
            var newSessionID = uuidv4();
            sql.query('INSERT INTO sessions (userID, sessionUUID, sessionCreation) VALUES (?,?,CURRENT_TIMESTAMP())', [results[0].userID,newSessionID],(error,results,fields)=>{
                if (error) throw error;
            });
            req.session.userID = newSessionID;
            res.json({result:'OK',message:'Session updated.'});
        }
    });
});

app.post('/article', function (req, res) {
    console.log('Article requested: ' + JSON.stringify(req.body));
    
    // If it is the first request (null), we remove the selector and just take the latest image
    if (typeof req.body.id == 'number') {
        var where = 'postType = ? AND postID < ?';
    } else {
        var where = 'postType = ?';
    }
    
    sql.query(`SELECT postID, posts.userID, users.username, postTime, description FROM posts JOIN users ON posts.userID = users.userID WHERE (${where}) ORDER BY postTime DESC, postID DESC LIMIT 1`,['imge',req.body.id],(error,results,fields)=>{
        if (error) throw error;
		
		console.log(JSON.stringify(results));

        if (results.length == 0) {
            res.json({result:'FAIL',data:"There's nothing to see."});
        } else {
            app.render('article', results[0],(err,html)=>{
				if (err) throw err;
				res.json({result:'OK',id:results[0].postID,data:html});
			});
        }
    });
});

wss.on('connection', (ws, req) => {
    console.log('Websocket connection made!');
    
    req.session.userId = uuidv4(); // New session code.
    
//    ws.isAlive = true;
//    ws.on('pong', heartbeat);
    
    ws.on('message', (message) => {
        console.log(`WS message: ${message}`);
        var data = JSON.parse(message);
        
        switch (data.process) {
            case 'signin':
                console.log("Submitted info: " + data.user);

                sql.query('SELECT userID FROM users WHERE userID = ?', [id], function (error, results, fields) {
                    if (error) throw error;

                    if (results.length == 0) {
                        // Send response to let client know server handled successfully, but with no returns
                        console.log('No account found.')
                        ws.send(JSON.stringify({callback:data.callback,user:false}));
                    } else {
                        // Login
                        console.log('ID recognized, serving data...');
                        sql.query('SELECT name, subject, format, type, start, end, time FROM assessments WHERE userID = ?', [id], function (error, results, fields) {
                            if (error) throw error;

                            console.log('Found user data.');
                            ws.send(JSON.stringify({callback:data.callback,user:{id:id, assessments:results}}));
                            recordWS(id,ws);
                        });
                        sql.query('UPDATE users SET lastLogin = CURRENT_TIMESTAMP(), lastIP = ? WHERE userID = ?', [ws._socket.remoteAddress + ws._socket.remotePort, id], function (error, results, fields) {
                            if (error) throw error;
                        });
                    }
                });
                break;
            default:
                console.log('Error in data.');
        }
    });
});

wss.on('close', (close) => {
    console.log('Websocket connection closed.');
//    console.log(JSON.stringify(req));
//    websocketUsers[data.user.id] = ws;
});

wss.on('error', (error) => {
    console.log('Websocket connection closed due to error.');
//    console.log(JSON.stringify(req));
//    websocketUsers[data.user.id] = ws;
});

//const keepalive = setInterval(function ping() {
//    for (var key in websocketUsers) {
//        if (websocketUsers.hasOwnProperty(key)) {
//            websocketUsers[key].forEach((ws,idx)=>{
//                if (ws.isAlive === false) {
//                    websocketUsers[key].splice(idx, 1);
//                    console.log('Terminating WS for user ' + key);
//                    console.log(websocketUsers[key].length + ' websockets connected');
//                    return;
////                    return ws.terminate();
//                }
//                ws.isAlive = false;
//                ws.ping('', false, true);
//            });
//        }
//    }
//}, 5000);

function createUser(callback,ws,ip) {
    const newCode = generateCode(6);
    console.log(`Creating new account with ID '${newCode}'...`);
    sql.query('INSERT INTO users (userID, lastLogin, lastIP) VALUES (?,CURRENT_TIMESTAMP(),?)', [newCode,ip], function (error, results, fields) {
        if (error) {
            console.log('Error: ' + error);
            if (error.errno == 1062) {
                console.log('Rerolling for new code...');
                createUser(ws,ip);
            } else {
                throw error;
            }
        } else {
            ws.send(JSON.stringify({callback:callback,user:{id:newCode,assessments:[]}}));
            recordWS(newCode,ws);
        }
    });
}

function alertUsers(id, sender) {
    sql.query('SELECT name, subject, format, type, start, end, time FROM assessments WHERE userID = ?', [id], function (error, results, fields) {
        if (error) throw error;

        websocketUsers[id].forEach((val)=>{
            if (val.readyState === WebSocket.OPEN && sender !== val) {
                console.log('Alerting user of ID' + id);
                val.send(JSON.stringify({process:'reload',callback:null,user:{id:id,assessments:results}}));
            }
        });
    });
}

function heartbeat() {
    this.isAlive = true;
}

function insertTestUserData() {
    var user = {
        username: 'roozeno',
        password: 'admin123',
        accountType: 'stdt',
        schoolID: 1,
        nzqaNum: 126555266,
        fullName: 'Ollie Roozen',
        yearLevel: 13,
        bio: 'Hello, world.'
    };
	
    var school = {
        nzqaNum: 347,
        title: 'Lincoln High School',
        location: 'Lincoln, Christchurch'
    };
	
    sql.query('INSERT INTO schools (nzqaNum,title,location) VALUES (?,?,?)', [school.nzqaNum,school.title,school.location],(error,results,fields)=>{
        if (error) {throw error};
        sql.query('INSERT INTO users (username,password,accountType,schoolID,nzqaNum,fullName,yearLevel,bio) VALUES (?,?,?,?,?,?,?,?)', [user.username,user.password,user.accountType,user.schoolID,user.nzqaNum,user.fullName,user.yearLevel,user.bio],(error,results,fields)=>{
        if (error) {throw error};
        	console.log('Inserted test user data into the database.');
			insertTestPostData();
        });
    });
}

function insertTestPostData() {
	// postType, userID, privacyLevel, description
	var posts = [
		['imge',1,0,"Look at dis cool image!"],
		['imge',1,0,"Fleek on point yo"],
		['imge',1,0,"Help"],
		['imge',1,0,"'And how can man die better, than facing fearful odds, for the ashes of his fathers, and the temples of his gods?'"],
		['imge',1,0,"XOXOXO Luv u gurls"],
		['imge',1,0,"Rest in piece XXX"],
		['imge',1,0,"Zac the cat is life"],
		['imge',1,0,"Le kek™"]
	];
	
	sql.query('INSERT INTO posts (postType,userID,privacyLevel,description) VALUES ?', [posts],(error,results,fields)=>{
		if (error) {throw error};
		console.log('Inserted test post data into the database.');
	});
}

/*
ALTER USER 'root'@'localhost'
IDENTIFIED BY 'admin' PASSWORD EXPIRE NEVER;
*/