//The MIT License (MIT)
	
	//Copyright (c) 2015 Dave Winer
	
	//Permission is hereby granted, free of charge, to any person obtaining a copy
	//of this software and associated documentation files (the "Software"), to deal
	//in the Software without restriction, including without limitation the rights
	//to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	//copies of the Software, and to permit persons to whom the Software is
	//furnished to do so, subject to the following conditions:
	
	//The above copyright notice and this permission notice shall be included in all
	//copies or substantial portions of the Software.
	
	//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	//IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	//FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	//AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	//LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	//OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	//SOFTWARE.
var appConsts = {
	productname: "myWordEditor",
	productnameForDisplay: "MyWord Editor",
	"description": "A simple silo-free blogging tool that creates beautiful essay pages.",
	urlTwitterServer: "http://twitter.myword.io/", //backup, in case config.json is missing
	domain: "myword.io", //the real value is set in startup () 
	version: "0.54"
	};
var appPrefs = {
	authorName: "", authorWebsite: "",
	ctStartups: 0, minSecsBetwAutoSaves: 3,
	textFont: "Ubuntu", textFontSize: 18, textLineHeight: 24,
	flDisqusComments: false, disqusGroupName: "smallpict",
	flRssPrefsInitialized: false, rssTitle: "", rssDescription: "", rssLink: "", rssMaxItemsInFeed: 25, rssLanguage: "en-us", 
	rssHistory: [], rssFeedUrl: "",
	flUseDefaultImage: false, defaultImageUrl: "",
	lastTweetText: "", lastUserName: "davewiner",
	fileSerialnum: 0,
	lastFilePath: "",
	lastPublishedUrl: ""
	};
var flStartupFail = false;
var flPrefsChanged = false, flFeedChanged = false;
var whenLastUserAction = new Date ();
var globalDefaultImageUrl = "http://scripting.com/2015/03/06/allmans.png";

var theData = { //the file being edited now
	title: "",
	description: "",
	authorname: "", 
	authorwebsite: "", 
	when: new Date (0),
	img: "", 
	subs: [],
	whenLastSave: new Date (0),
	ctSaves: 0,
	publishedUrl: "",
	linkJson: "" //3/24/15 by DW
	};
var urlTemplateFile = "http://myword.io/editor/templates/default.html";
var jsontextForLastSave;
var whenLastUserAction = new Date (), whenLastKeystroke = whenLastUserAction;
var randomMysteryString, ctCloseAttempts = 0;
var fnameconfig = "config.json"; //3/20/15 by DW



function getAllPosts (callback) {
	var postArray = [];
	function readOne (ix) {
		if (ix > 0) {
			var path = "essays/" + padWithZeros (ix, 3) + ".json";
			twGetFile (path, true, true, function (error, data) {
				if (data != undefined) {
					postArray [ix - 1] = JSON.parse (data.filedata);
					}
				readOne (ix - 1);
				});
			}
		else {
			twUploadFile ("files.json", jsonStringify (postArray), "application/json", false, function (data) {
				if (callback !== undefined) {
					callback (postArray, data.url);
					}
				});
			}
		}
	readOne (appPrefs.fileSerialnum);
	}
function getPostsInJson () {
	getAllPosts (function (postArray, urlJsonFile) {
		confirmDialog ("View the JSON file?", function () {
			window.open (urlJsonFile);
			});
		});
	}
function closeFileOpenDialog () {
	$("#idFileOpenDialog").modal ("hide"); 
	}
function openThisFile (id) {
	appPrefs.lastFilePath = id;
	openEssayFile (function () {
		prefsChanged ();
		closeFileOpenDialog ();
		});
	}
function fileOpenDialog () {
	getAllPosts (function (postArray, urlJsonFile) {
		var htmltext = "<div class=\"divFileList\"><ul>";
		for (var i = 0; i < postArray.length; i++) {
			var obj = postArray [i];
			console.log (obj.title + ": " + obj.filePath);
			htmltext += "<li><a onclick=\"openThisFile ('" + obj.filePath + "');\">" + obj.title + "</a></li>";
			}
		htmltext += "</ul></div>";
		$("#idFileOpenDialog").modal ("show"); 
		$("#idWhereToDisplayFileList").html (htmltext);
		});
	}
function publishAllPosts () { //3/24/15 by DW
	confirmDialog ("Publish all posts?", function () {
		var savedFilePath = appPrefs.lastFilePath;
		function publishOne (ix, callback) {
			if (ix > 0) {
				appPrefs.lastFilePath = "essays/" + padWithZeros (ix, 3) + ".json";
				openEssayFile (function () {
					console.log ("publishAllPosts: publishing " + appPrefs.lastFilePath);
					publishButtonClick (false, function () {
						publishOne (ix - 1, callback);
						});
					});
				}
			else {
				if (callback !== undefined) {
					callback ();
					}
				}
			}
		publishOne (appPrefs.fileSerialnum, function () {
			appPrefs.lastFilePath = savedFilePath;
			openEssayFile ();
			});
		});
	}
function fieldsToHistory () { //copy from theData into the current history array element
	function getBodyText () {
		var s = "";
		for (var i = 0; i < theData.subs.length; i++) {
			s += "<p>" + theData.subs [i] + "</p>";
			}
		return (s);
		}
	for (var i = 0; i < appPrefs.rssHistory.length; i++) {
		var obj = appPrefs.rssHistory [i];
		if (obj.filepath == theData.filePath) {
			console.log ("fieldsToHistory: copying data into history array element #" + i);
			obj.guid.flPermalink = true;
			obj.guid.value = theData.publishedUrl;
			obj.title = theData.title;
			obj.link = theData.publishedUrl;
			obj.text = getBodyText ();
			obj.twitterScreenName = twGetScreenName ();
			obj.when = theData.when;
			obj.filepath = theData.filePath;
			obj.linkJson = theData.linkJson;
			break;
			}
		}
	}
function addToHistory () {
	var obj = new Object ();
	appPrefs.rssHistory.unshift (obj);
	while (appPrefs.rssHistory.length > appPrefs.rssMaxItemsInFeed) {
		appPrefs.rssHistory.pop ();
		}
	obj.guid = new Object ();
	obj.filepath = theData.filePath; //otherwise fieldsToHistory won't find it! oy
	fieldsToHistory ();
	}
function myWordBuildRssFeed () {
	var headElements = {
		title: appPrefs.rssTitle,
		link: appPrefs.rssLink,
		description: appPrefs.rssDescription,
		language: appPrefs.rssLanguage,
		generator: appConsts.productnameForDisplay + " v" + appConsts.version,
		docs: "http://cyber.law.harvard.edu/rss/rss.html",
		twitterScreenName: twGetScreenName (),
		maxFeedItems: appPrefs.rssMaxItemsInFeed,
		appDomain: appConsts.domain
		}
	var xmltext = buildRssFeed (headElements, appPrefs.rssHistory);
	twUploadFile ("rss.xml", xmltext, "text/xml", false, function (data) {
		console.log ("buildRssFeed: url == " + data.url);
		if (appPrefs.rssFeedUrl != data.url) {
			appPrefs.rssFeedUrl = data.url;
			prefsChanged ();
			}
		});
	}
function viewPrefs () {
	console.log (jsonStringify (appPrefs));
	}
function viewPublishedFile () {
	var url = theData.publishedUrl;
	if (url.length == 0) {
		alertDialog ("Can't view the file because the current essay hasn't been published yet.");
		}
	else {
		window.open (url);
		}
	}
function viewFeed () {
	if (appPrefs.rssFeedUrl.length == 0) {
		alertDialog ("Can't view the feed because no essays have been posted.");
		}
	else {
		window.open (appPrefs.rssFeedUrl);
		}
	}
function applyPrefs () {
	theData.authorname = appPrefs.authorName;
	theData.authorwebsite = appPrefs.authorWebsite;
	
	appPrefs.defaultImageUrl = trimWhitespace (appPrefs.defaultImageUrl); //3/8/15 by DW
	
	prefsChanged ();
	}
function keyupTextArea () {
	}
function newFileData () { //set fields of theData to represent a new file
	theData.body = "";
	theData.title = "";
	theData.description = "";
	theData.subs = [];
	
	theData.authorname = appPrefs.authorName;
	theData.authorwebsite = appPrefs.authorWebsite;
	
	theData.img = "";
	theData.when = new Date ();
	theData.whenLastSave = new Date (0);
	theData.ctSaves = 0;
	theData.filePath = "essays/" + padWithZeros (++appPrefs.fileSerialnum, 3) + ".json";
	theData.publishedUrl = "";
	theData.linkJson = ""; //3/24/15 by DW
	
	addToHistory ();
	
	appPrefs.lastFilePath = theData.filePath;
	appPrefs.lastPublishedUrl = "";
	viewPublishedUrl ();
	prefsChanged ();
	}
function dataToFields () {
	function getBodyText () {
		var s = "";
		for (var i = 0; i < theData.subs.length; i++) {
			if (s.length > 0) {
				s += "\n\n";
				}
			s += theData.subs [i];
			}
		return (s);
		}
	$("#idTitle").val (theData.title);
	$("#idDescription").val (theData.description);
	$("#idImageUrl").val (theData.img);
	$("#idTextArea").val (getBodyText ());
	}
function fieldsToData () {
	theData.body = $("#idTextArea").val ();
	theData.title = $("#idTitle").val ();
	theData.description = $("#idDescription").val ();
	theData.img = $("#idImageUrl").val ();
	theData.subs = $("#idTextArea").val ().split ("\n\n");
	}
function saveButtonClick (callback) {
	var now = new Date ();
	
	fieldsToData ();
	fieldsToHistory ();
	
	theData.whenLastSave = now;
	theData.ctSaves++;
	jsontextForLastSave = jsonStringify (theData);
	
	$("#idSavedStatus").html ("");
	twUploadFile (appPrefs.lastFilePath, jsontextForLastSave, "text/plain", true, function (data) {
		console.log ("saveButtonClick: " + data.url + " (" + secondsSince (now) + " seconds)");
		$("#idSavedStatus").html ("SAVED");
		if (callback != undefined) {
			callback ();
			}
		});
	}
function newButtonClick () {
	confirmDialog ("Erase all fields, starting a new web page?", function () {
		newFileData ();
		dataToFields ();
		saveButtonClick ();
		});
	}
function viewPublishedUrl () {
	$("#idPublishedUrl").html ("<a href=\"" + appPrefs.lastPublishedUrl + "\" target=\"_blank\">" + appPrefs.lastPublishedUrl + "</a>");
	}
function getCommentHtml (whenCreated) {
	if (appPrefs.flDisqusComments) {
		var code = "&lt;div class=\"divComments\">&lt;script>var disqus_identifier = \"" + whenCreated + "\"&lt;/script>&lt;div id=\"disqus_thread\">&lt;/div>&lt;/div>&lt;script type=\"text/javascript\" src=\"http://disqus.com/forums/" + appPrefs.disqusGroupName + "/embed.js\">&lt;/script>&lt;/div>&lt;/div>";
		return (code.replace (/&lt;/g,'<'));
		}
	else {
		return ("");
		}
	}
function publishButtonClick (flInteract, callback) {
	//Changes
		//3/24/15; 6:53:47 PM by DW
			//New optional param, flInteract. If false, we don't put up a dialog asking if the user wants to see the rendered file. 
		//3/21/15; 5:31:07 PM by DW
			//There is one specific circumstance where we have to upload twice. If appPrefs.lastPublishedUrl is the empty string, we upload the first time to set the value, then upload again, so that it can be correct in the pagetable. The Facebook metadata needs the canonical URL for the page to be correct. 
	var now = new Date ();
	if (flInteract === undefined) {
		flInteract = true;
		}
	fieldsToData ();
	function uploadOnce (templatetext, callback) {
		var username = twGetScreenName ();
		var filepath = replaceAll (theData.filePath, ".json", ".html");
		var urlpage = appPrefs.lastPublishedUrl; //"http://myword.io/users/" + username + filepath;
		var urlimage = theData.img;
		if (urlimage.length == 0) {
			if (appPrefs.flUseDefaultImage && (appPrefs.defaultImageUrl.length > 0)) { //user has specified a default image, use it
				urlimage = appPrefs.defaultImageUrl;
				}
			else {
				urlimage = globalDefaultImageUrl;
				}
			}
		var pagetable = {
			flFromEditor: true,
			authorname: theData.authorname,
			authorwebsite: theData.authorwebsite,
			when: theData.when,
			body: theData.body,
			pagetitle: theData.title,
			ogtitle: theData.title,
			ogdescription: theData.description,
			ogimage: urlimage,
			ogurl: urlpage,
			twscreenname:  "@" + username,
			twtitle:  theData.title,
			twdescription:  theData.description,
			twimage:  urlimage,
			rssfeedurl: appPrefs.rssFeedUrl
			};
		pagetable.pagetableinjson = jsonStringify (pagetable);
		pagetable.commenttext = getCommentHtml (theData.when);
		var renderedtext = multipleReplaceAll (templatetext, pagetable, false, "[%", "%]");
		twUploadFile (theData.filePath, pagetable.pagetableinjson, "application/json", false, function (data) {
			theData.linkJson = data.url;
			twUploadFile (filepath, renderedtext, "text/html", false, function (data) {
				console.log ("publishButtonClick: pagetable == " + jsonStringify (pagetable));
				console.log ("publishButtonClick: " + data.url + " (" + secondsSince (now) + " seconds)");
				callback (data);
				});
			});
		}
	function afterUpload (data) {
		viewPublishedUrl ();
		prefsChanged ();
		feedChanged ();
		saveButtonClick (function () {
			if (flInteract) {
				confirmDialog ("View the published essay?", function () {
					window.open (data.url);
					if (callback != undefined) {
						callback ();
						}
					});
				}
			else {
				if (callback != undefined) {
					callback ();
					}
				}
			});
		}
	readHttpFile (urlTemplateFile, function (templatetext) {
		uploadOnce (templatetext, function (data) {
			if (appPrefs.lastPublishedUrl.length == 0) { //have to upload a second time
				appPrefs.lastPublishedUrl = data.url;
				theData.publishedUrl = data.url;
				uploadOnce (templatetext, function (data) {
					afterUpload (data);
					});
				}
			else {
				afterUpload (data);
				}
			});
		});
	}
function openEssayFile (callback) {
	if (appPrefs.lastFilePath.length == 0) { //first run
		newFileData ();
		dataToFields ();
		jsontextForLastSave = jsonStringify (theData);
		if (callback !== undefined) {
			callback ();
			}
		}
	else {
		twGetFile (appPrefs.lastFilePath, true, true, function (error, data) {
			if (data != undefined) {
				try {
					theData = JSON.parse (data.filedata);
					$("#idTextArea").val (theData.body);
					$("#idTitle").val (theData.title);
					$("#idDescription").val (theData.description);
					$("#idImageUrl").val (theData.img);
					console.log ("openEssayFile: data == " + data.filedata);
					}
				catch (err) {
					newFileData ();
					console.log ("openEssayFile: error == " + err.message);
					}
				}
			else {
				newFileData ();
				console.log ("openEssayFile: error == " + jsonStringify (error));
				}
			dataToFields ();
			jsontextForLastSave = jsonStringify (theData);
			if (callback != undefined) {
				callback ();
				}
			});
		}
	}
function showHideEditor () {
	var homeDisplayVal = "none", aboutDisplayVal = "none", startupFailDisplayVal = "none";
	
	if (twIsTwitterConnected ()) {
		if (flStartupFail) {
			startupFailDisplayVal = "block";
			}
		else {
			homeDisplayVal = "block";
			}
		}
	else {
		aboutDisplayVal = "block";
		}
	
	$("#idEditor").css ("display", homeDisplayVal);
	$("#idLogonMessage").css ("display", aboutDisplayVal);
	$("#idStartupFailBody").css ("display", startupFailDisplayVal);
	}
function prefsChanged () {
	flPrefsChanged = true;
	}
function feedChanged () {
	flFeedChanged = true;
	}
function settingsCommand () {
	twStorageToPrefs (appPrefs, function () {
		prefsDialogShow ();
		});
	}
function switchServer () { //3/19/15 by DW
	askDialog ("URL of new server:", twStorageData.urlTwitterServer, "Enter the URL of your server here.", function (s, flcancel) {
		if (!flcancel) {
			localStorage.urlTwitterServer = s;
			twStorageData.urlTwitterServer = s;
			twDisconnectFromTwitter ();
			twConnectToTwitter ();
			}
		});
	}
function initMenus () {
	var cmdKeyPrefix = getCmdKeyPrefix (); //10/6/14 by DW
	document.getElementById ("idMenuProductName").innerHTML = appConsts.productnameForDisplay; 
	document.getElementById ("idMenuAboutProductName").innerHTML = appConsts.productnameForDisplay; 
	$("#idMenubar .dropdown-menu li").each (function () {
		var li = $(this);
		var liContent = li.html ();
		liContent = liContent.replace ("Cmd-", cmdKeyPrefix);
		li.html (liContent);
		});
	twUpdateTwitterMenuItem ("idTwitterConnectMenuItem");
	twUpdateTwitterUsername ("idTwitterUsername");
	}
function everySecond () {
	var now = clockNow ();
	twUpdateTwitterMenuItem ("idTwitterConnectMenuItem");
	twUpdateTwitterUsername ("idTwitterUsername");
	pingGoogleAnalytics ();
	showHideEditor ();
	
	//auto-save
		if (secondsSince (whenLastKeystroke) >= 1) {
			var jsontext;
			fieldsToData ();
			jsontext = jsonStringify (theData);
			if (jsontext != jsontextForLastSave) {
				saveButtonClick ();
				}
			}
	
	if (flPrefsChanged) {
		twPrefsToStorage (appPrefs);
		flPrefsChanged = false;
		}
	if (flFeedChanged) {
		myWordBuildRssFeed ();
		flFeedChanged = false;
		}
	
	//if another copy of MWE launched, we are not needed, we quit
		if (localStorage.youAreNotNeeded != undefined) {
			if (localStorage.youAreNotNeeded != randomMysteryString) {
				if (ctCloseAttempts < 2) { 
					ctCloseAttempts++;
					window.close ();
					}
				}
			}
	}
function tellOtherInstancesToQuit () {
	randomMysteryString = getRandomPassword (25);
	localStorage.youAreNotNeeded = randomMysteryString; 
	}
function startup () {
	var flSkipConfigRead = false;
	function readConfigJson (flSkipServerSet, callback) { //3/20/15 by DW
		readHttpFile (fnameconfig, function (s) {
			if (s !== undefined) { //the file exists and was read correctly
				try {
					var jstruct = JSON.parse (s);
					console.log ("readConfigJson: " + fnameconfig + " contains " + jsonStringify (jstruct));
					if (!flSkipServerSet) {
						if (jstruct.urlTwitterServer !== undefined) {
							twStorageData.urlTwitterServer = jstruct.urlTwitterServer;
							console.log ("readConfigJson: twStorageData.urlTwitterServer == " + twStorageData.urlTwitterServer);
							}
						}
					if (jstruct.urlDefaultImage != undefined) { //3/21/15 by DW
						globalDefaultImageUrl = jstruct.urlDefaultImage;
						console.log ("readConfigJson: globalDefaultImageUrl == " + globalDefaultImageUrl);
						}
					}
				catch (err) {
					console.log ("readConfigJson: err == " + err);
					}
				}
			callback ();
			});
		}
	console.log ("startup");
	$("#idTwitterIcon").html (twStorageConsts.fontAwesomeIcon);
	$("#idVersionNumber").html ("v" + appConsts.version);
	appConsts.domain = stringNthField (window.location.href, "/", 3); //3/22/15 by DW
	$("#idEditor").keyup (function () {
		whenLastUserAction = new Date ();
		whenLastKeystroke = whenLastUserAction;
		});
	initMenus ();
	hitCounter (); 
	initGoogleAnalytics (); 
	tellOtherInstancesToQuit ();
	twGetOauthParams (); //redirects if OAuth params are present
	//determine the URL of the nodeStorage server -- 3/19/15 by DW
		if (localStorage.urlTwitterServer !== undefined) {
			twStorageData.urlTwitterServer = localStorage.urlTwitterServer;
			flSkipConfigRead = true; //the localStorage value takes precedence
			}
		else {
			twStorageData.urlTwitterServer = appConsts.urlTwitterServer;
			}
	readConfigJson (flSkipConfigRead, function () {
		if (twIsTwitterConnected ()) {
			twUserWhitelisted (twGetScreenName (), function (flwhitelisted) {
				if (flwhitelisted) {
					twStorageStartup (appPrefs, function (flGoodStart) {
						flStartupFail = !flGoodStart;
						if (flGoodStart) {
							openEssayFile (function () {
								showHideEditor ();
								viewPublishedUrl ();
								appPrefs.ctStartups++;
								prefsChanged ();
								applyPrefs ();
								twGetTwitterConfig (function () { //twStorageData.twitterConfig will have information from twitter.com
									twGetUserInfo (twGetScreenName (), function (userData) {
										if (appPrefs.authorName.length == 0) {
											appPrefs.authorName = userData.name;
											theData.authorname = userData.name; //3/21/15 by DW
											prefsChanged ();
											}
										if (appPrefs.authorWebsite.length == 0) {
											appPrefs.authorWebsite = userData.url;
											theData.authorwebsite = userData.url; //3/21/15 by DW
											prefsChanged ();
											twDerefUrl (appPrefs.authorWebsite, function (longUrl) { //try to unshorten the URL
												appPrefs.authorWebsite = longUrl;
												theData.authorwebsite = longUrl; //3/21/15 by DW
												prefsChanged ();
												});
											}
										twitterToPrefs (userData); //fill in RSS prefs with info we got from Twitter
										console.log ("startup: user info == " + jsonStringify (userData));
										});
									self.setInterval (everySecond, 1000); 
									});
								});
							}
						});
					}
				else {
					alertDialog ("Can't open the editor because there was an error connecting to the server, " + twStorageData.urlTwitterServer + ", or the user \"" + twGetScreenName () + "\" is not whitelisted.");
					}
				});
			}
		else {
			showHideEditor ();
			}
		});
	}
