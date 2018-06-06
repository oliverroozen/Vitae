"use strict";

// Global constant declarations for general use across program
var callDate = new Date();
const prlxCoef = 500;
const blurCoef = 10;
const background = 'body#welcome .background img';
const title = 'body#welcome .intro div.title';
const host = "ws://" + window.location.host;
const BGmonth = [
    ['JANUARY','library-1-min.jpg'],
    ['FEBRUARY','library-2-min.jpg'],
    ['MARCH','library-3-min.jpg'],
    ['APRIL','library-4-min.jpg'],
    ['MAY','library-5-min.jpg'],
    ['JUNE','library-6-min.jpg'],
    ['JULY','library-7-min.jpg'],
    ['AUGUST','library-8-min.jpg'],
    ['SEPTEMBER','library-9-min.jpg'],
    ['OCTOBER','study-1-min.jpg'],
    ['NOVEMBER','study-2-min.jpg'],
    ['DECEMBER','study-3-min.jpg']
];
const crntMonth = callDate.getMonth();
var monthIteration = crntMonth;
var backgroundUpdate;
var notificationSocket;
var connectionRetry;
var currentlyEditing = false;
var WScallbacks = [];
var userData = {};

establishWebsocket();

// As soon as the DOM is ready to manipulate...
$(document).ready(()=>{
    console.log('Document ready!');
    
    // Waiting until background image is ready to start slideshow...
    if ($(background).prop('complete')) {
        initBackground();
    } else {
        $(background).load(()=>{
            initBackground();
        });
    }
    
    animEmphasis();
    
    // Ping the server to see if a logged user account is valid. If so, load and enter program.
    if (Cookies.get('userID') != undefined) {
        handleWS('signin', {id:Cookies.get('userID')}, (user)=>{
            if (user == false) {
                revisionDisplay.load('#exampleDisplay', [
                    ["Science","Technology","Engineering","Arts","Mathematics"],
                    [1,1,1,1,1]
                ]);
            } else {
                console.log('%cWelcome back, student!','background: #222; color: rgb(5,255,255); font-size:1.5em; padding:3px;');
                
                revisionDisplay.load('#exampleDisplay', revisionDisplay.calcImportance(user.assessments));
                loadMain();
            }
        });
    } else {
        revisionDisplay.load('#exampleDisplay', [
            ["Science","Technology","Engineering","Arts","Mathematics"],
            [1,1,1,1,1]
        ]);
    }
    
    // When the user clicks to start the program
    $('.info').on('click','a#start',(event)=>{
        // Check if an account is already loaded and valid. Not sure if this can actually happen, though.
        if (typeof userData.code == 'undefined') {
            handleWS('signup', {}, (user)=>{
                revisionDisplay.update(revisionDisplay.calcImportance(user.assessments));
                loadMain();
            });
        }
    });
    
    // Event handler for when a.edit element inside .assessmentsScreen is clicked.
    // These events (including the a.delete and a.submit ones) are inside document.ready
    // to prevent errors with the DOM not being ready.
    $('.revisionDisplay .assessmentsScreen').on('click','a.edit',(event)=>{
        if (typeof currentlyEditing == 'boolean') {
            editField(event);
        }
    });
    
    // When a.delete clicked...
    $('.revisionDisplay .assessmentsScreen').on('click','a.delete',(event)=>{
        // Find relevant row, delete row
        var assessmentCode = $(event.target).attr('data-assessment-code');
        
        console.warn("Deleting assessment " + assessmentCode);
        userData.assessments.splice(assessmentCode,1);
        editAssessments(true);
        
        currentlyEditing = false;
    });
    
    // When a.add clicked...
    $('.revisionDisplay .assessmentsScreen').on('click','a.add',(event)=>{
        if (typeof currentlyEditing == 'boolean') {
            userData.assessments.push({
                name: "",
                subject: "",
                format: "",
                type: "",
                start: "",
                end: "",
                time: ""
            });
            editAssessments(true);
            editField(userData.assessments.length-1);
        }
    });
	
	// When a.submit clicked...
    $('.revisionDisplay .assessmentsScreen').on('click','a.submit',(event)=>{
        // Call savefield function
        saveField(event.target);
    });
	
	// If enter button is hit on assessments screen
    $('.assessmentsScreen').on('keyup',(event)=>{
        if (event.keyCode == 13) {
            // Save the corresponding row
            saveField($(event.target).parent().closest('tr'));
        }
    });
    
    // If enter button is hit on code input screen
    $('#accountManagement .popup #codeInput').on('keyup',(event)=>{
        const neutStyle = {"color":'',"box-shadow":'',"border-color":''},
              failStyle = {"color":'rgb(150,0,0)',"box-shadow":'0 0 6px RGB(255,58,58)',"border-color":'RGB(255,40,40)'},
              succStyle = {"color":'rgb(0,150,0)',"box-shadow":'0 0 6px RGB(58,255,58)',"border-color":'RGB(40,255,40)'};
        
        if (event.keyCode == 13) {
            // Submit code
            var submittedCode = $('#codeInput').val();
            if (submittedCode.length != 6) {
                $('#codeInput').css(failStyle);
            } else {
                $('#codeInput').css(neutStyle);
                handleWS('signin', {id:submittedCode}, (user)=>{
                    if (user == false) {
                        $('#codeInput').css(failStyle);
                    } else {
                        revisionDisplay.update(revisionDisplay.calcImportance(user.assessments));
                        
                        $('#codeInput').css(succStyle);
                        $('body#welcome .background img').css({filter:''});
                        setTimeout(()=>{
                            $('#accountManagement div.popup').fadeOut(300);
                        },500)
                        loadMain();
                    }
                });
            }
        }
    });
    
//    $('.popup').on('keyup',(event)=>{
//        if (event.keyCode == 27) {
//            $(event.target).attr('data-function-handler')
//        }
//    });
});

// When the window is resized...
$(window).resize(()=>{
    sizeBG();
});

// When mouse is moved on the webpage...
$(document).mousemove((event)=>{
    if ($('.intro').is(":hover")) {
        parralax(event);
    }
});

// Sets a specific title and background image based on input month
function setFrontpageMonth(month) {
    const bgCrossfadeRate = 1600;
    var monthBG = BGmonth[month];
    
    if (month % 2) {
        $(background).eq(0).fadeIn(bgCrossfadeRate);
        $(background).eq(1).fadeOut(bgCrossfadeRate,()=>{
            $(background).eq(1).attr('src',`assets/background/${monthBG[1]}`);
        });
    } else {
        $(background).eq(1).fadeIn(bgCrossfadeRate);
        $(background).eq(0).fadeOut(bgCrossfadeRate,()=>{
            $(background).eq(0).attr('src',`assets/background/${monthBG[1]}`);
        });
    }
    
    sizeBG();
    
    $(title).text(monthBG[0]);
    if (month == crntMonth) {
        $(title).css({"color":"rgb(80,10,10)"});
    } else {
        $(title).css({"color":""});
    }
}

// Function that automatically positions the background based on the dimensions of the image and the viewport
function sizeBG() {
    const windowAspectRatio = $(window).width() / $(window).height();
    const backgroundAspectRatio = $(background).width() / $(background).height();
    
    if (windowAspectRatio < backgroundAspectRatio) {
        $(background).css({
            'height':`calc(100vh + ${(($(window).height()/2)/prlxCoef)*2}% + ${blurCoef}px)`,
            'width':'initial'
        });
    } else {
        $(background).css({
            'width':`calc(100vw + ${(($(window).width()/2)/prlxCoef)*2}% + ${blurCoef}px)`,
            'height':'initial'
        });
    }
}

// Creates throttled parallax function that fires max 30fps to cut down lag
var parralax = _.throttle((event) => { // event.pageX, event.pageY
    var xDiff = event.pageX - $(window).width()/2;
    var yDiff = event.pageY - $(window).height()/2;
    
    $("body#welcome .background img").css({
        'transform':`translate(${(xDiff/-prlxCoef)-50}%,${(yDiff/-prlxCoef)-50}%)`
    });
    $("body#welcome .intro > .wrapper").css({
        'transform':`translate(${(xDiff/(prlxCoef*8))-50}%,${(yDiff/(prlxCoef*8))-50}%)`
    });
},1000/30);

// Generates a code of X length using uppercase chars, lowercase chars, and numbers
function generateCode(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for(var i=0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    
    return text;
}

// Bubble animation
function animEmphasis() {
    const elements = $('.info .start div.circle');
    var count = 0;
    var pulseDuration = 300;
    
    var circleIterate = setInterval(function() {
        elements.eq(count).toggleClass('circleOpacityPulse');
        count = (count + 1) % 3;
    }, pulseDuration/3);
}

// Websocket code
function establishWebsocket() {
    notificationSocket = new WebSocket(host);
    
    notificationSocket.addEventListener('open', (event)=>{
        console.log('Websocket connection online.');
        $('#disconnectedOverlay').fadeOut(600);
    });
    notificationSocket.addEventListener('close', (event)=>{
        console.log('Socket closed.');
        
        connectionRetry = setTimeout(()=>{
            establishWebsocket();
        },5000);
        
        $('#disconnectedOverlay').fadeIn(600);
    });
    notificationSocket.addEventListener('error', (event)=>{
        console.error('Error connecting to websocket server!');
    });
    notificationSocket.addEventListener('message', (event)=>{
        var data = JSON.parse(event.data);

        console.log(data);

        if (data.process == 'reload') {
            console.warn('Server alerted to changes, updating data.');
            updateUser(data.user, false);
            revisionDisplay.update(revisionDisplay.calcImportance(data.user.assessments));
        } else {
            if (data.user != false) {
                updateUser(data.user, false);
            }
            WScallbacks[data.callback](data.user);
            WScallbacks.splice(data.callback,1);
        }
    });
}

function handleWS(mode, user, callback) {
    var lastIndex = WScallbacks.push(callback) - 1;
    notificationSocket.send(JSON.stringify({process:mode,callback:lastIndex,user:user}));
}

// Function for showing input fields for a given row
function editField(event) {
    var assessmentCode = event;
    
    currentlyEditing = assessmentCode;
        
    // Finds row, if needed convert object
    if (typeof event == 'object') {assessmentCode = $(event.target).attr('data-assessment-code')};
    var row = `.revisionDisplay .assessmentsScreen table tr[data-assessment-code="${assessmentCode}"]`;

    // Copies the value name into each repective input element
    $(`${row} input, ${row} select`).each((index,element)=>{
        $(element).val(userData.assessments[assessmentCode][$(element).attr('name')]);
    });

    // Hides normal text, shows the input boxes
    $(`${row} p, ${row} a.edit`).hide();
    $(`${row} input, ${row} select, ${row} a.delete, ${row} a.submit`).fadeIn(200);
}

// Function to save a given assessment 'row' to the userdata object given a input field from that row
function saveField(target) {
	console.log('Save initiated');
	var assessmentCode = $(target).attr('data-assessment-code');
	var row = `.revisionDisplay .assessmentsScreen table tr[data-assessment-code="${assessmentCode}"]`;

	console.log(row);
    currentlyEditing = false;
    var cont = true;
    
    // Iterate through all fields in row
	$(`${row} input, ${row} select`).each((index,element)=>{
        var value = $(element).val();
        
        // Prevent row being submitted if any field empty
        if (value == "" || value == null) {
            console.log('Field empty!');
            $(element).css({"box-shadow":'0 0 6px RGB(255,58,58)',"border-color":'RGB(255,40,40)'});
            cont = false;
        } else {
            $(element).css({"box-shadow":'',"border-color":''});
            userData.assessments[assessmentCode][$(element).attr('name')] = value;
        }
	});

    var startMS = new Date(userData.assessments[assessmentCode].start).getTime();
    var endMS = new Date(userData.assessments[assessmentCode].end).getTime();
    
    // If end date is before start date, or too close/far apart, prevent submit
    if (startMS > endMS || Math.abs(endMS - startMS) > 3.15e10 || Math.abs(endMS - startMS) < 8.6e7) { // Min 1 day, max 1 year
        cont = false;
        $(`${row} input[name="start"], ${row} input[name="end"]`).css({"box-shadow":'0 0 6px RGB(255,58,58)',"border-color":'RGB(255,40,40)'});
    }
    
    // If no problems, save fields to userData and update chart
    if (cont) {editAssessments(true)} else {return};
	$(`${row} input, ${row} select, ${row} a.delete, ${row} a.submit`).hide();
	$(`${row} p, ${row} a.edit`).fadeIn(200);
}

// Function that sets up and shows the slideshow background...
function initBackground() {
    // Set up cycle of background
    $(background).eq(0).attr('src',`assets/background/${BGmonth[crntMonth-1][1]}`);
    $(background).eq(0).fadeIn(2000);
    sizeBG();

    // Sets the title page to begin on the current month
    setFrontpageMonth(crntMonth);
    
    // Timer that iterates through different backgrounds & months
    backgroundUpdate = setInterval(()=>{
        monthIteration = (monthIteration + 1) % BGmonth.length;
        setFrontpageMonth(monthIteration);
    },4000);
}

function updateUser(newUser, refresh) {
    Cookies.set('userID', newUser.id, {expires: 183, path: ''});
    userData = newUser;
    
    console.log(newUser);
    
    if (refresh) {
        userData.assessments.sort(function(a,b){return new Date(a.end).getTime() > new Date(b.end).getTime()});
        
        revisionDisplay.update(revisionDisplay.calcImportance(newUser.assessments));
        
        handleWS('update',newUser,(user)=>{
            if (user == false) {
                console.log('Failed to update data to server.');
            } else {
                console.log('Updated successfully!');
            }   
        });
    }
}

// Function from StackOverflow that resolves length of an object
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
}

// Function to format date in MMM-DD format for readibility
function formatDateUser(date) {
    if (date == '') {return};
        
    var dateOjb = new Date(date);
    return `${BGmonth[dateOjb.getMonth()][0].substr(0,3).toLowerCase().capFL()} ${dateOjb.getDate()}<i>${getOrdinal(dateOjb.getDate())}</i>`;
}

// Function from StackOverflow for finding the ordinal to a number
function getOrdinal(num) {
    var s = ["th","st","nd","rd"],
    v = num % 100;
    return (s[(v - 20) % 10] || s[v] || s[0]);
}

// Function to convert 24h HH:MM time into 12h HH:MM AM/PM format
function displayTime12H(time) {
    // 12PM = 12 | 12AM = 0
    if (time == '') {return};
    
    var hourMin = (time).match(/(\d\d)/g);
    
    var mode;
    if (hourMin[0] >= 12) {
        mode = 'PM'; 
        hourMin[0] %= 12;
    } else {
        mode = 'AM';
    }
    
    if (hourMin[0] == 0) {
        hourMin[0] = 12;
    }
    
    return `${+hourMin[0]}:${hourMin[1]} <i>${mode}</i>`;
}

// Function to convert the raw assessment type into readable format
function displayAssessmentFormat(format) {
    var formats = {
        "prjt":"Project",
        "exam":"Exam",
        "prct":"Practical",
        "othr":"Other"
    }
    return formats[format];
}

// Function to convert the raw assessment type into readable format
function displayAssessmentType(type) {
    var types = {
        "prac":"Practice",
        "full":"Full"
    }
    return types[type];
}

// Checks to see if assessment is currently active, and should be displayed
function checkIfActive(startTime, endTime, crntTime) {
    if (startTime < crntTime && endTime > crntTime) {
        return true;
    } else {
        return false;
    }
}

// Appends function to string prototype for capatalizing first letter
String.prototype.capFL = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

// Appends function to number prototype for adding 0s to beginning of number
Number.prototype.pad = function(n) {
    return new Array(n).join('0').slice((n || 2) * -1) + this;
}

window.onbeforeunload = function() {
    websocket.onclose = function () {}; // disable onclose handler first
    websocket.close();
};

/*
// Main title 3D text animation
function titleEntrance() {
    var letters = $('#title .main span');
    var subContainer = $('#title .container');
    var letterQuantity = letters.length;
    var count = 0;
    var entryTime = 1500;
    
    var letterIterate = setInterval(function() {
        if (count <= letterQuantity) {
            letters.eq(count).addClass('letterSpin');
            count++;
        } else {
            clearTimeout(letterIterate);
            subContainer.css('opacity','1');
        }
    }, entryTime/letterQuantity); 
}
*/