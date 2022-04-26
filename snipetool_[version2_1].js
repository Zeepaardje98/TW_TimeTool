var timeColor = "green";
var waitingColor = "#ff9933";
var noDateColor = "green";

(async () => {
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
        init: function () {
            this.loadSettings();
            this.createTable(() => {
                document.getElementById("remember2").checked = this.remember;
                document.getElementById("delay").value = parseInt(this.delay);
                this.retrieveInput();
            });

        },
        updateSettings: function () {
            if (this.remember) {
                this.settings.remember = this.remember;
                this.settings.delay = this.delay;
            } else {
                this.settings.remember = false;
                this.settings.delay = 0;
            }
            localStorage.setItem(game_data.world + 'confirmenhancersettings', JSON.stringify(this.settings));
        },
        loadSettings: function () {
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
        retrieveInput: function () {
            delay.addEventListener("input", () => {
                this.delay = parseInt(document.getElementById("delay").value);
                this.updateSettings();
            });
            remember2.addEventListener("input", () => {
                this.remember = document.getElementById("remember2").checked;
                this.updateSettings();
            });
        },
        createTable: function (_callback) {
            var form = document.getElementById("command-data-form");
            var villageUrl = document.getElementById("command-data-form").getElementsByClassName("village_anchor")[0].getElementsByTagName("a")[0].href;
            var duration = $('#date_arrival span').data('duration') * 1000;

            var parent = this;
            $.when(loadRunningCommands(villageUrl).done(function (html) {
                const commandsTable = $(html).find('.commands-container');
                var delay = document.createElement("delay");
                delay.innerHTML = ("<div style='width:100%; height:20px'></div><div width=100%>delay: <input type='number' id='delay' style='width: 100px;'/>     remember: <input type='checkbox' id='remember2'/></div>");
                form.appendChild(delay);
                if (commandsTable.length > 0) {
                    commandsTable.find('tr:first').append('<th>Send in</th>');
                    commandsTable.find('tr.command-row').each(function () {
                        $(this).css('cursor', 'pointer');
                        const sendTime = ($(this).find('td:last span').data('endtime') * 1000) - duration;
                        $(this).append(`<td class="sendTime"><b><span class="timer" style="color: darkblue" data-endtime="${sendTime / 1000}"></span></b></b><br></td>`);
                    }).filter(function () {
                        return $('img[src*="/return_"], img[src*="/back.png"]', this).length > 0;
                    }).remove();
                    if (commandsTable.length > 0) $('#remember2').after(commandsTable);
                    Timing.tickHandlers.timers.handleTimerEnd = function () {
                        $(this).text('Too Late!');
                        $(this).css('color', 'red');
                    };
                    Timing.tickHandlers.timers.init();
                }

                _callback();

                // Select a command, Change color of selected Command. Update
                // the selected time/date
                commandClick();
                function commandClick() {
                    $(".command-row").click(function () {
                        $(this).closest("tbody").find("td").css('background-color', '');
                        $(this).find("td").css("background-color", "white");
                        parent.fillSnipeTool($(this).find("td")[1].textContent);
                    });
                }
                // Expose method
                window.enableIncomingsClicker = () => commandClick();

                // Add the timer for the command arrivel countdowns
                $(".widget-command-timer").addClass("timer");
                Timing.tickHandlers.timers.initTimers('widget-command-timer');
                Timing.tickHandlers.timers.init();

            }))
        },
        /* NOTE This doesnt trigger the eventlisteners which update the input of
         *      the snipetool. Fix this */
        fillSnipeTool: function (timestring) {
            const t = timestring.match(/\d+:\d+:\d+:\d+/);
            const serverDate = $('#serverDate').text().replace(/\//g, '-').replace(/(\d{1,2})-(\d{1,2})-(\d{4})/g, '$3-$2-$1');
            let date = new Date(serverDate + ' ' + t);

            if (timestring.match('morgen')) {
                date = new Date(date.setDate(date.getDate() + 1));
            } else if (timestring.match(/\d+\.\d+/)) {
                let monthDate = timestring.match(/\d+\.\d+/)[0].split('.');
                date = new Date(date.getFullYear() + '-' + monthDate[1] + '-' + monthDate[0] + ' ' + t);
            }

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
        init: function () {
            const previousUrlSearchParams = new URLSearchParams(document.referrer);

            this.sendButton = document.getElementById("troop_confirm_go");
            this.oldElement = document.getElementById("date_arrival");

            this.loadSettings();
            this.duration = $('#date_arrival span').data('duration') * 1000;

            if (document.referrer.indexOf('arrivalTimestamp') > -1) {
                const arrivalTime = parseInt(previousUrlSearchParams.get('arrivalTimestamp'));
                this.timeGoal = arrivalTime;
                this.msGoal = new Date(arrivalTime).getMilliseconds();
            }

            /* Create all HTML elements for display. */
            var progressBar = document.createElement("bar");
            var timeGoalInput = document.createElement("timegoal");
            var msGoalInput = document.createElement("msgoal");
            var rememberInput = document.createElement("remember")
            progressBar.innerHTML = ("<div id='progress_bar'><div id='time'></div><div id='bar'></div></div>");
            timeGoalInput.innerHTML = ("<div width='100%'>snipe time: <input type=datetime-local max=\"9999-12-31T23:59:59\" id='timegoal' step='1'></div>");
            msGoalInput.innerHTML = ("<div width='100%'>snipe ms: <input type='number' id='msgoal' style='width: 100px;'/></div>");
            rememberInput.innerHTML = ("<div width='100%'><label>remember: <input type='checkbox' id='remember'/></label><div id='watermark'>made by Ricardo/Bottenkraker.</div></div>");

            this.oldElement.appendChild(progressBar);
            this.oldElement.appendChild(timeGoalInput);
            this.oldElement.appendChild(msGoalInput);
            this.oldElement.appendChild(rememberInput);

            // Add send time element to the command form
            var stuur = document.createElement("tr");
            if (this.timeGoal !== 0) {
                var sendTime = this.timeGoal - this.duration;
                var sendDate = new Date(sendTime)
                stuur.innerHTML = ("<td>Stuurtijd:</td><td>" + sendDate.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'numeric'
                }) + "&nbsp;" + "<b>" + sendDate.toLocaleTimeString() + "</b>" + "&nbsp;&nbsp;&nbsp;(<span class='timer2' id='timer2' data-endtime='" + sendTime / 1000 + "'></span>)</td>");

                $(window.TribalWars).on("global_tick", function () {
                    document.title = 'Send in: ' + $('#timer2').text();
                });

            } else {
                stuur.innerHTML = ("<td>Stuurtijd:</td><td></td>");
            }
            document.getElementById("command-data-form").getElementsByTagName("table")[0].getElementsByTagName("tbody")[0].appendChild(stuur);
            stuur.id = 'sendtime';
            Timing.tickHandlers.timers.initTimers('timer2');


            document.getElementById("remember").checked = this.remember;
            if (this.timeGoal !== 0) {
                document.getElementById("timegoal").value = msToDatetimeLocal(this.timeGoal);
            }
            document.getElementById("msgoal").value = this.msGoal;

            /* NOTE: I think this function sometimes executes before the input
             *       table is made. */
            this.retrieveInput();

        },
        loadSettings: function () {
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
        updateSettings: function () {
            if (this.remember) {
                this.settings.msGoal = this.msGoal;
                this.settings.timeGoal = this.timeGoal;
                this.settings.remember = this.remember;
            } else {
                this.settings.msGoal = 0;
                this.settings.timeGoal = 0;
                this.settings.remember = false;
            }
            localStorage.setItem(game_data.world + 'snipesettings', JSON.stringify(this.settings));
        },
        retrieveInput: function () {
            msgoal.addEventListener("input", () => {
                this.msGoal = parseInt(document.getElementById("msgoal").value);
                this.updateSettings();
            });
            timegoal.addEventListener("input", () => {
                this.timeGoal = (new Date(document.getElementById("timegoal").value)).getTime();
                if (this.timeGoal !== this.prevTimeGoal) {
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
        updateBar: function () {
            var servertime = Math.round(Timing.getCurrentServerTime());

            /* How far the current ms is to the next goal, with 999ms distance
             * 0%, and 0ms distance being 100%. */
            var percentage = ((servertime - this.msGoal) % 1000) / 10;
            document.getElementById("bar").style.width = percentage.toString() + "%";

            /* Current TW server Timestamp. */
            var element = document.getElementsByClassName("relative_time")[0];
            var timestamp = element.innerHTML.match(/\w+\s+\w+\s+\d+:\d+:\d+/) ?? element.innerHTML.match(/\w+\s+\d+\.\d+\.\s+\w+\s+\d+:\d+:\d+/);
            document.getElementById("time").innerHTML = timestamp[0].slice(-8);

            /* Check if the user has given a timestamp. If so, let the bar filling
             * up be green if it is filling up to the given timestamp + ms.
             * Otherwise let the bar be orange. */
            if (!isNaN(this.timeGoal)) {
                sendtime = (this.timeGoal - this.duration) + this.msGoal;

                if (servertime > sendtime - 1000 && servertime <= sendtime) {
                    document.getElementById("bar").style.background = timeColor;
                } else {
                    document.getElementById("bar").style.background = waitingColor;
                }
            } else {
                document.getElementById("bar").style.background = noDateColor;
            }

        },
        updateSendtime: function () {
            stuur = document.getElementById("sendtime");
            if (this.timeGoal !== 0 && !isNaN(this.timeGoal)) {
                var sendTime = this.timeGoal - this.duration;
                var sendDate = new Date(sendTime);
                stuur.innerHTML = ("<td>Stuurtijd:</td><td>" + sendDate.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'numeric'
                }) + "&nbsp;" + "<b>" + sendDate.toLocaleTimeString() + "</b>" + "&nbsp;&nbsp;&nbsp;(<span class='timer2' id='timer2' data-endtime='" + sendTime / 1000 + "'></span>)</td>");

                $(window.TribalWars).on("global_tick", function () {
                    document.title = 'Send in: ' + $('#timer2').text();
                });

                Timing.tickHandlers.timers.initTimers('timer2');
            } else if (this.timeGoal !== 0 && !isNaN(this.timeGoal)) {
                stuur.innerHTML = ("<td>Stuurtijd:</td><td></td>");
                document.title = "No Time Given";
            }
        },
        /* Take a timestamp HH:MM:SS and returns the timestamp in milliseconds. */
        timestampToMs: function (timestamp) {
            return (((timestamp.slice(-8, -6) * 3600) +
                (timestamp.slice(-5, -3) * 60) +
                (timestamp.slice(-2) * 1)) * 1000);
        },
        /* Add CSS to the current document. */
        addGlobalStyle: function (css) {
            var head, style;
            head = document.getElementsByTagName('head')[0];
            if (!head) return;

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
        // Expose method
        /* Interval for updating the snipetool, or delete it if we don't need
         * it anymore. */
        var update = setInterval(function () {
            if (document.getElementById("date_arrival")) {
                SnipeTool.updateBar();
            }
        }, 1000 / SnipeTool.fps);

        $("#troop_confirm_submit").click(function () {
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
        x.observe(document.getElementById('ds_body'), {childList: true});
    }

    function loadRunningCommands(targetId) {
        return twLib.get({
            url: game_data.link_base_pure + 'info_village&id=' + targetId,
        });
    }
})();