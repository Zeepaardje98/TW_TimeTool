function msToDatetimeLocal(ms) {
    goalDate = new Date(ms);
    string = (goalDate.getFullYear() + "-" +
             ("0" + (goalDate.getMonth() + 1)).slice(-2) + "-" +
             ("0" + goalDate.getDate()).slice(-2) + "T" +
             ("0" + goalDate.getHours()).slice(-2) + ":" +
             ("0" + goalDate.getMinutes()).slice(-2) + ":" +
             ("0" + goalDate.getSeconds()).slice(-2));
    return string;
}

Incomings = {
    settings: null,
    remember: false,
    delay: 0,
    init: function() {
        this.loadSettings();
        this.createTable(() => {
            document.getElementById("remember2").checked = this.remember;
            document.getElementById("delay").value = parseInt(this.delay);
            this.retrieveInput();
        });

    },
    updateSettings: function() {
        if (this.remember) {
            this.settings.remember = this.remember;
            this.settings.delay = this.delay;
        }
        else {
            this.settings.remember = false;
            this.settings.delay = 0;
        }
        localStorage.setItem(game_data.world + 'confirmenhancersettings', JSON.stringify(this.settings));
    },
    loadSettings: function() {
        var settings = JSON.parse(localStorage.getItem(game_data.world + 'confirmenhancersettings')) || {};
        if (localStorage.getItem(game_data.world + 'confirmenhancersettings') === null) {
            settings.delay = 0;
            settings.remember = false;
            localStorage.setItem(game_data.world + 'confirmenhancersettings', JSON.stringify(settings));
        }
        this.settings = settings;
        this.remember = this.settings.remember;
        this.delay = this.settings.delay;
    },
    retrieveInput: function() {
        delay.addEventListener("input", () => {
            this.delay = parseInt(document.getElementById("delay").value);
            this.updateSettings();
        });
        remember2.addEventListener("input", () => {
            this.remember = document.getElementById("remember2").checked;
            this.updateSettings();
        });
    },
    createTable: function(_callback) {
        var form = document.getElementById("command-data-form");
        var villageUrl = document.getElementById("command-data-form").getElementsByClassName("village_anchor")[0].getElementsByTagName("a")[0].href;

        var parent = this;
        $.get(villageUrl, function(html) {
            // Get the commands from a different page and show them on the
            // current page
            commands = $(html).find("#commands_outgoings, #commands_incomings")[0];
            if (commands) {
                var delay = document.createElement("delay");
                delay.innerHTML = ("<div style='width:100%; height:20px'></div><div width=100%>delay: <input type='number' id='delay' style='width: 100px;'/>     remember: <input type='checkbox' id='remember2'/></div>");
                form.appendChild(delay);
                form.appendChild(commands);
                _callback();
            }

            // Select a command, Change color of selected Command. Update
            // the selected time/date
            $(".command-row").click(function() {
                $(this).closest("tbody").find("td").css('background-color', '');
                $(this).find("td").css("background-color", "white");
                parent.fillSnipeTool($(this).find("td")[1].textContent);
            });

            // Add the timer for the command arrivel countdowns
            $(".widget-command-timer").addClass("timer");
            Timing.tickHandlers.timers.initTimers('widget-command-timer');
        });
    },
    /* NOTE This doesnt trigger the eventlisteners which update the input of
     *      the snipetool. Fix this */
    fillSnipeTool: function(timestring) {
        // Get the time and ms where you want the command to arrive
        ms = timestring.slice(-7, -4);
        time = timestring.slice(-16, -8);

        var currentdate = new Date();
        var date;
        // Command has to arrive today, set date to today
        if (timestring.slice(0, 1) == "v") {
            date = new Date(currentdate.getUTCFullYear(), currentdate.getUTCMonth(), currentdate.getUTCDate());
        }
        // Command has to arrive tomorrow, set date to tomorrow
        else if (timestring.slice(0, 1) == "m") {
            date = new Date(currentdate.getUTCFullYear(), currentdate.getUTCMonth(), currentdate.getUTCDate());
            date.setDate(date.getDate() + 1);
        }
        // Command has to arrive on a specific date, set this date
        else if (timestring.slice(0, 1) == "o") {
            var month = parseInt(timestring.slice(6, 8)) - 1;
            var day = parseInt(timestring.slice(3, 5));

            var year = currentdate.getUTCFullYear();
            if (month < currentdate.getMonth()) {
                year += 1
            }

            date = new Date(year, month, day);
        }

        // Create the exact arrivel time of the command and fill the forms with
        // this time.
        date = new Date(date.getFullYear(), date.getMonth(), date.getDate(),
                        time.slice(0, 2), time.slice(3, 5), time.slice(6, 8), ms);
        date.setMilliseconds(date.getMilliseconds() + this.delay);
        document.getElementById("msgoal").value = date.getMilliseconds();
        document.getElementById("timegoal").value = msToDatetimeLocal(date.getTime());

        var event = new Event('input');
        msgoal.dispatchEvent(event);
        timegoal.dispatchEvent(event);
    }
}


SnipeTool = {
    sendButton: null,
    oldElement: null,
    fps: 60,
    settings: null,
    remember: false,
    msGoal: 0,
    timeGoal: 0,
    prevTimeGoal: 0,
    duration: 0,
    init: function() {
        this.sendButton = document.getElementById("troop_confirm_go");
        this.oldElement = document.getElementById("date_arrival");

        this.loadSettings();
        if (document.getElementById("command-data-form").getElementsByClassName("vis")[0].getElementsByTagName("tbody")[0].getElementsByTagName("tr")[2].getElementsByTagName("td")[0].innerHTML === "Speler:") {
            // Sending to a player, duration is 4th <tr> element
            this.duration = this.timestampToMs(document.getElementById("command-data-form").getElementsByClassName("vis")[0].getElementsByTagName("tbody")[0].getElementsByTagName("tr")[3].getElementsByTagName("td")[1].innerHTML);
        } else {
            // Attacking a barbarian, duration is 3rd <tr> element
            this.duration = this.timestampToMs(document.getElementById("command-data-form").getElementsByClassName("vis")[0].getElementsByTagName("tbody")[0].getElementsByTagName("tr")[2].getElementsByTagName("td")[1].innerHTML);
        }

        /* Create all HTML elements for display. */
        var progressBar = document.createElement("bar");
        var timeGoalInput = document.createElement("timegoal");
        var msGoalInput = document.createElement("msgoal");
        var rememberInput = document.createElement("remember")
        progressBar.innerHTML = ("<div id='progress_bar'><div id='time'></div><div id='bar'></div></div>");
        timeGoalInput.innerHTML =  ("<div width='100%'>snipe time: <input type=datetime-local id='timegoal' step='1'></div>");
        msGoalInput.innerHTML = ("<div width='100%'>snipe ms: <input type='number' id='msgoal' style='width: 100px;'/></div>");
        rememberInput.innerHTML = ("<div width='100%'><label>remember: <input type='checkbox' id='remember'/></label><div id='watermark'>made by Ricardo/Bottenkraker.</div></div>");

        this.oldElement.appendChild(progressBar);
        this.oldElement.appendChild(timeGoalInput);
        this.oldElement.appendChild(msGoalInput);
        this.oldElement.appendChild(rememberInput);

        // Add send time element to the command form
        var stuur = document.createElement("tr");
        if (this.timeGoal != 0) {
            var sendTime = this.timeGoal - this.duration;
            var sendDate = new Date(sendTime)
            stuur.innerHTML = ("<td>Stuurtijd:</td><td>" + sendDate.toLocaleDateString(undefined, {day:'numeric', month: 'numeric'}) + "&nbsp;" + "<b>" + sendDate.toLocaleTimeString() + "</b>" + "&nbsp;&nbsp;&nbsp;(<span class='timer2' data-endtime='" + sendTime / 1000 + "'></span>)</td>");
            document.title = sendDate.toLocaleTimeString();
        } else {
            stuur.innerHTML = ("<td>Stuurtijd:</td><td></td>");
        }
        document.getElementById("command-data-form").getElementsByTagName("table")[0].getElementsByTagName("tbody")[0].appendChild(stuur);
        stuur.id='sendtime';
        Timing.tickHandlers.timers.initTimers('timer2');


        document.getElementById("remember").checked = this.remember;
        if (this.timeGoal != 0) {
            document.getElementById("timegoal").value = msToDatetimeLocal(this.timeGoal);
        }
        document.getElementById("msgoal").value = this.msGoal;

        /* NOTE: I think this function sometimes executes before the input
         *       table is made. */
        this.retrieveInput();

    },
    loadSettings: function() {
        var settings = JSON.parse(localStorage.getItem(game_data.world + 'snipesettings')) || {};
        if (localStorage.getItem(game_data.world + 'snipesettings') === null) {
            settings.msGoal = 0;
            settings.timeGoal = 0;
            settings.remember = false;
            localStorage.setItem(game_data.world + 'snipesettings', JSON.stringify(settings));
        }
        this.settings = settings;
        this.remember = this.settings.remember;
        this.msGoal = this.settings.msGoal;
        this.timeGoal = this.settings.timeGoal;
    },
    updateSettings: function() {
        if (this.remember) {
            this.settings.msGoal = this.msGoal;
            this.settings.timeGoal = this.timeGoal;
            this.settings.remember = this.remember;
        }
        else {
            this.settings.msGoal = 0;
            this.settings.timeGoal = 0;
            this.settings.remember = false;
        }
        localStorage.setItem(game_data.world + 'snipesettings', JSON.stringify(this.settings));
    },
    retrieveInput: function() {
        msgoal.addEventListener("input", () => {
            this.msGoal = parseInt(document.getElementById("msgoal").value);
            this.updateSettings();
        });
        timegoal.addEventListener("input", () => {
            this.timeGoal = (new Date(document.getElementById("timegoal").value)).getTime();
            if (this.timeGoal != this.prevTimeGoal) {
                this.updateSendtime();
                this.prevTimeGoal = this.timeGoal;
            }
            this.updateSettings();
        });
        remember.addEventListener("input", () => {
            this.remember = document.getElementById("remember").checked;
            this.updateSettings();
        });
    },
    updateBar: function() {
        var servertime = Math.round(Timing.getCurrentServerTime());

        /* How far the current ms is to the next goal, with 999ms distance
         * 0%, and 0ms distance being 100%. */
        var percentage = ((servertime - this.msGoal) % 1000)/10;
        document.getElementById("bar").style.width = percentage.toString() + "%";

        /* Current TW server Timestamp. */
        var element = document.getElementsByClassName("relative_time")[0];
        var timestamp = element.innerHTML.match(/\w+\ \w+\ \d+\:\d+\:\d+/)[0].slice(-8);
        document.getElementById("time").innerHTML = timestamp;

        /* Check if the user has given a timestamp. If so, let the bar filling
         * up be green if it is filling up to the given timestamp + ms.
         * Otherwise let the bar be orange. */
        if (!isNaN(this.timeGoal)) {
            sendtime = (this.timeGoal - this.duration) + this.msGoal;

            if (servertime > sendtime - 1000 && servertime <= sendtime) {
                document.getElementById("bar").style.background = "green";
            } else {
                document.getElementById("bar").style.background = "#ff9933";
            }
        } else {
            document.getElementById("bar").style.background = "green";
        }

    },
    updateSendtime: function() {
        stuur = document.getElementById("sendtime");
        if (this.timeGoal != 0 && !isNaN(this.timeGoal)) {
            var sendTime = this.timeGoal - this.duration;
            var sendDate = new Date(sendTime);
            stuur.innerHTML = ("<td>Stuurtijd:</td><td>" + sendDate.toLocaleDateString(undefined, {day:'numeric', month: 'numeric'}) + "&nbsp;" + "<b>" + sendDate.toLocaleTimeString() + "</b>" + "&nbsp;&nbsp;&nbsp;(<span class='timer2' data-endtime='" + sendTime / 1000 + "'></span>)</td>");
            document.title = sendDate.toLocaleTimeString();

            Timing.tickHandlers.timers.initTimers('timer2');
        } else if (this.timeGoal != 0 && !isNaN(this.timeGoal)) {
            stuur.innerHTML = ("<td>Stuurtijd:</td><td></td>");
            document.title = "No Time Given";
        }
    },
    /* Take a timestamp HH:MM:SS and returns the timestamp in milliseconds. */
    timestampToMs: function(timestamp) {
        return (((timestamp.slice(-8, -6) * 3600) +
                (timestamp.slice(-5, -3) * 60) +
                (timestamp.slice(-2) * 1)) * 1000);
    },
    /* Add CSS to the current document. */
    addGlobalStyle: function(css) {
        var head, style;
        head = document.getElementsByTagName('head')[0];
        if (!head) { return; }
        style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        head.appendChild(style);
    }
};

SnipeTool.addGlobalStyle("#progress_bar {width: 100%; height: 20px; background-color: grey;}");
SnipeTool.addGlobalStyle("#time {width: 100%; height: 20px; text-align: center; vertical-align: middle; padding-top:3px}");
SnipeTool.addGlobalStyle("#bar {width: 0%; background: green; height: 20px; margin-top: -23px;}");
SnipeTool.addGlobalStyle("#watermark {font-size: 6px; color: grey; text-align: right; margin-top: -10px;}");


/* Function setting up the snipetool and confirm enhancer. Also checks when to
 * stop updating the script(this happens automatically when you stop sending
 * your attack, but this takes a while. When sending an attack you want the
 * updating bar to stop as soon as possible, to get an idea of how accurate
 * your timing was).
 */
function startScript() {
    SnipeTool.init();
    Incomings.init();

    /* Interval for updating the snipetool, or delete it if we don't need
     * it anymore. */
    var update = setInterval(function() {
        if (document.getElementById("date_arrival")) {
            SnipeTool.updateBar();
        }
    }, 1000 / SnipeTool.fps);

    $("#troop_confirm_go").click(function() {
        console.log("sent at", Timing.getCurrentServerTime() % 1000, "ms");
        clearInterval(update);
        SnipeTool.updateSettings();
        Incomings.updateSettings();
    });
}

/* When on the rally point, you can immedietly start the script*/
if (document.getElementById("date_arrival")) {
    startScript();
} else {
    /* When on the map, check if the user is opening an attack window before
     * starting the script. The script_started statement prevents a bug where
     * the script is being started twice. */
    var script_started = false;
    var x = new MutationObserver(function (e) {
        if (e[0].removedNodes && document.getElementById("date_arrival") && !script_started) {
            script_started = true;
            startScript();
        } else if (!document.getElementById("date_arrival")) {
            script_started = false;
        }
    });
    x.observe(document.getElementById('ds_body'), { childList: true });
}
