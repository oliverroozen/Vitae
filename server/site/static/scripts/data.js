"use strict";

// Function that handles content of the 'manage account' button
function accountPrompt() {
    console.log(userData);
    if ($('#accountManagement div.popup').css('display') == 'none') {
        if (userData.id == "" || userData.id == undefined) {
            $('div.popup .code h1').text("You don't have a code");
            $('div.popup h2.tip').show();
        } else {
            $('div.popup .code h1').text("YOUR CODE IS: " + userData.id);
            $('div.popup h2.tip').hide();
        }
        $('body#welcome .background img').css({filter:'blur(15px) brightness(10%) saturate(150%)'});
        $('#accountManagement div.popup').fadeIn(300);
    } else {
        $('body#welcome .background img').css({filter:''});
        $('#accountManagement div.popup').fadeOut(300);
    }
}

// Function that initializes the revision display, and creates/loads a user account
function loadMain() {
    $('body#welcome div.intro, body#welcome div.background').hide();
    $('body#welcome #accountManagement > a').text('Manage Account');
    $('.revisionDisplay a.edit').css("display", "inline-block");
    $('body#welcome .info div.text').hide();
    $('body#welcome .info').css({"background-color":"rgb(20,20,20)",top:'0vh'});
    clearInterval(backgroundUpdate);
}

function editAssessments(display) {
    if ($('.revisionDisplay .assessmentsScreen').css('display') == 'none' || display == true) {
        if (Object.size(userData.assessments) > 0) {
            var assessmentList = "<table><tbody><tr class='heading'><th>Assessment</th><th>Subject</th><th>Format</th><th>Type</th><th>Started on</th><th>Ends on</th><th>Time due</th><th></th></tr>";
            for (var key = 0; key < userData.assessments.length; key++) {
                const row = userData.assessments[key];
                assessmentList += (`
                    <tr class="active-${checkIfActive(new Date(row.start).getTime(), new Date(row.end).getTime(), new Date().getTime())}" data-assessment-code="${key}">
                        <td>
                            <p>${row.name}</p>
                            <input class="" name="name" spellcheck="false" autocomplete="true" maxlength="64" placeholder='Assessment' type="text">
                        </td>
                        <td>
                            <p>${row.subject}</p>
                            <input class="" name="subject" spellcheck="false" autocomplete="true" maxlength="64" placeholder='Subject' type="text">
                        </td>
                        <td>
                            <p>${displayAssessmentFormat(row.format)}</p>
                            <select name="format">
                                <option value="exam" selected>Exam</option>
                                <option value="prjt">Project</option>
                                <option value="prct">Practical</option>
                                <option value="othr">Other</option>
                            </select>
                        </td>
                        <td>
                            <p>${displayAssessmentType(row.type)}</p>
                            <select name="type">
                                <option value="prac">Practice</option>
                                <option value="full" selected>Full</option>
                            </select>
                        </td>
                        <td>
                            <p>${formatDateUser(row.start)}</p>
                            <input class="" name="start" autocomplete="true" maxlength="64" placeholder='Start date' type="date">
                        </td>
                        <td>
                            <p>${formatDateUser(row.end)}</p>
                            <input class="" name="end" autocomplete="true" maxlength="64" placeholder='End date' type="date">
                        </td>
                        <td>
                            <p>${displayTime12H(row.time)}</p>
                            <input class="" name="time" autocomplete="true" maxlength="64" placeholder='Due time' type="time">
                        </td>
                        <td>
                            <a class="edit" title="Edit assessment" data-assessment-code="${key}">&#61508;</a>
                            <a class="submit" title="Save changes" data-assessment-code="${key}">&#61639;</a>
                            <a class="delete" title="Delete assessment" data-assessment-code="${key}">&#61460;</a>
                        </td>
                    </tr>
                `);
            }
            assessmentList += '<tr><td colspan="8"><a class="add" title="Add assessment">&#61694;</a><a class="done" onclick="editAssessments()" title="Exit">&#61770;</a></td></tr></tbody></table>';
            $('.revisionDisplay .assessmentsScreen').html(assessmentList);
        } else {
            $('.revisionDisplay .assessmentsScreen').html(`You don't have any assessments.<br>Either congradulations, or add them here!
                <table><tbody><tr><td colspan="8"><a class="add" title="Add assessment">&#61694;</a><a class="done" onclick="editAssessments()" title="Done">&#61770;</a></td></tr></tbody></table>`
            );
        }
        $('.revisionDisplay .assessmentsScreen').fadeIn(500);
    } else {
        if (typeof currentlyEditing == 'number') {
            userData.assessments.splice(currentlyEditing,1);
            currentlyEditing = false;
        }
        
        updateUser(userData, true);
        $('.revisionDisplay .assessmentsScreen').fadeOut(500);
    }
}

function tell(message) {
    notificationSocket.send(message);
}

// Dev-callable function to insert some preset data into the program
function insertTestData() {
    updateUser({id: userData.id, assessments: [
        {
            name: "1.04 Mechanics",
            subject: "Science",
            format: "exam",
            type: "full",
            start: "2017-04-22",
            end: "2017-06-05",
            time: "05:22"
        },
        {
            name: "1.2 Connections",
            subject: "English",
            format: "prjt",
            type: "full",
            start: "2017-02-16",
            end: "2017-08-02",
            time: "10:22"
        },
        {
            name: "2.1 Algebra",
            subject: "Mathematics",
            format: "exam",
            type: "prac",
            start: "2017-05-15",
            end: "2017-06-02",
            time: "16:00"
        },
        {
            name: "6.3 Still Life",
            subject: "Photography",
            format: "prjt",
            type: "full",
            start: "2017-08-25",
            end: "2017-09-12",
            time: "04:00"
        },
        {
            name: "1.1 Sequences & Series",
            subject: "Mathematics",
            format: "exam",
            type: "prac",
            start: "2017-02-02",
            end: "2017-03-08",
            time: "14:25"
        },
        {
            name: "3.4 Genres",
            subject: "Media Production",
            format: "exam",
            type: "full",
            start: "2017-02-01",
            end: "2017-07-30",
            time: "20:30"
        }
    ]}, true);
}

// Dev-callable function to remove all data
function resetData() {
    updateUser({id: userData.id, assessments: []}, true);
}

//var userData = {
//    code: "",
//    assessments: {
//        "":{
//            name: "",
//            subject: "",
//            format: "",
//            type: "",
//            practice: true/false,
//            start: "yyyy-mm-dd",
//            end: "yyyy-mm-dd",
//            time: "hh:mm"
//        }
//    }
//};

//&#61460;
//&#61510;
// ctx.pieces_drawn.all_drawn