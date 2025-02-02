if (typeof jQuery != 'undefined') {
  mejs.$ = jQuery;
} else if (typeof ender != 'undefined') {
  mejs.$ = ender;
}
(function ($) {

  // default player values
  mejs.MepDefaults = {
    // url to poster (to fix iOS 3.x)
    poster: '',
    // When the video is ended, we can show the poster.
    showPosterWhenEnded: false,
    // default if the <video width> is not specified
    defaultVideoWidth: 480,
    // default if the <video height> is not specified
    defaultVideoHeight: 270,
    // if set, overrides <video width>
    videoWidth: -1,
    // if set, overrides <video height>
    videoHeight: -1,
    // default if the user doesn't specify
    defaultAudioWidth: 400,
    // default if the user doesn't specify
    defaultAudioHeight: 30,
    // default amount to move back when back key is pressed
    defaultSeekBackwardInterval: function (media) {
      return (media.duration * 0.05);
    },
    // default amount to move forward when forward key is pressed
    defaultSeekForwardInterval: function (media) {
      return (media.duration * 0.05);
    },
    // set dimensions via JS instead of CSS
    setDimensions: true,
    // width of audio player
    audioWidth: -1,
    // height of audio player
    audioHeight: -1,
    // initial volume when the player starts (overrided by user cookie)
    startVolume: 0.8,
    // useful for <audio> player loops
    loop: false,
    // rewind to beginning when media ends
    autoRewind: true,
    // resize to media dimensions
    enableAutosize: true,
    // forces the hour marker (##:00:00)
    alwaysShowHours: false,
    // show framecount in timecode (##:00:00:00)
    showTimecodeFrameCount: false,
    // used when showTimecodeFrameCount is set to true
    framesPerSecond: 25,
    // automatically calculate the width of the progress bar based on the sizes of other elements
    autosizeProgress: true,
    // Hide controls when playing and mouse is not over the video
    alwaysShowControls: false,
    // Display the video control
    hideVideoControlsOnLoad: false,
    // Enable click video element to toggle play/pause
    clickToPlayPause: true,
    // force iPad's native controls
    iPadUseNativeControls: false,
    // force iPhone's native controls
    iPhoneUseNativeControls: false,
    // force Android's native controls
    AndroidUseNativeControls: false,
    // features to show
    features: ['playpause', 'current', 'progress', 'duration', 'tracks', 'volume', 'fullscreen'],
    // only for dynamic
    isVideo: true,
    // turns keyboard support on and off for this instance
    enableKeyboard: true,
    // whenthis player starts, it will pause other players
    pauseOtherPlayers: true,
    // array of keyboard actions such as play pause
    keyActions: [
      {
        keys: [
          32, // SPACE
          179 // GOOGLE play/pause button
        ],
        action: function (player, media) {
          if (media.paused || media.ended) {
            player.play();
          } else {
            player.pause();
          }
        }
      },
      {
        keys: [38], // UP
        action: function (player, media) {
          player.container.find('.mejs-volume-slider').css('display', 'block');
          if (player.isVideo) {
            player.showControls();
            player.startControlsTimer();
          }

          var newVolume = Math.min(media.volume + 0.1, 1);
          media.setVolume(newVolume);
        }
      },
      {
        keys: [40], // DOWN
        action: function (player, media) {
          player.container.find('.mejs-volume-slider').css('display', 'block');
          if (player.isVideo) {
            player.showControls();
            player.startControlsTimer();
          }

          var newVolume = Math.max(media.volume - 0.1, 0);
          media.setVolume(newVolume);
        }
      },
      {
        keys: [
          37, // LEFT
          227 // Google TV rewind
        ],
        action: function (player, media) {
          if (!isNaN(media.duration) && media.duration > 0) {
            if (player.isVideo) {
              player.showControls();
              player.startControlsTimer();
            }

            // 5%
            var newTime = Math.max(media.currentTime - player.options.defaultSeekBackwardInterval(media), 0);
            media.setCurrentTime(newTime);
          }
        }
      },
      {
        keys: [
          39, // RIGHT
          228 // Google TV forward
        ],
        action: function (player, media) {
          if (!isNaN(media.duration) && media.duration > 0) {
            if (player.isVideo) {
              player.showControls();
              player.startControlsTimer();
            }

            // 5%
            var newTime = Math.min(media.currentTime + player.options.defaultSeekForwardInterval(media), media.duration);
            media.setCurrentTime(newTime);
          }
        }
      },
      {
        keys: [70], // F
        action: function (player, media) {
          if (typeof player.enterFullScreen != 'undefined') {
            if (player.isFullScreen) {
              player.exitFullScreen();
            } else {
              player.enterFullScreen();
            }
          }
        }
      },
      {
        keys: [77], // M
        action: function (player, media) {
          player.container.find('.mejs-volume-slider').css('display', 'block');
          if (player.isVideo) {
            player.showControls();
            player.startControlsTimer();
          }
          if (player.media.muted) {
            player.setMuted(false);
          } else {
            player.setMuted(true);
          }
        }
      }
    ]
  };

  mejs.mepIndex = 0;

  mejs.players = {};

  // wraps a MediaElement object in player controls
  mejs.MediaElementPlayer = function (node, o) {
    // enforce object, even without "new" (via John Resig)
    if (!(this instanceof mejs.MediaElementPlayer)) {
      return new mejs.MediaElementPlayer(node, o);
    }

    var t = this;

    // these will be reset after the MediaElement.success fires
    t.$media = t.$node = $(node);
    t.node = t.media = t.$media[0];

    // check for existing player
    if (typeof t.node.player != 'undefined') {
      return t.node.player;
    } else {
      // attach player to DOM node for reference
      t.node.player = t;
    }


    // try to get options from data-mejsoptions
    if (typeof o == 'undefined') {
      o = t.$node.data('mejsoptions');
    }

    // extend default options
    t.options = $.extend({}, mejs.MepDefaults, o);

    // unique ID
    t.id = 'mep_' + mejs.mepIndex++;

    // add to player array (for focus events)
    mejs.players[t.id] = t;

    // start up
    t.init();

    return t;
  };

  // actual player
  mejs.MediaElementPlayer.prototype = {
    hasFocus: false,
    controlsAreVisible: true,
    init: function () {

      var
        t = this,
        mf = mejs.MediaFeatures,
        // options for MediaElement (shim)
        meOptions = $.extend(true, {}, t.options, {
          success: function (media, domNode) {
            t.meReady(media, domNode);
          },
          error: function (e) {
            t.handleError(e);
          }
        }),
        tagName = t.media.tagName.toLowerCase();

      t.isDynamic = (tagName !== 'audio' && tagName !== 'video');

      if (t.isDynamic) {
        // get video from src or href?
        t.isVideo = t.options.isVideo;
      } else {
        t.isVideo = (tagName !== 'audio' && t.options.isVideo);
      }

      // use native controls in iPad, iPhone, and Android
      if ((mf.isiPad && t.options.iPadUseNativeControls) || (mf.isiPhone && t.options.iPhoneUseNativeControls)) {

        // add controls and stop
        t.$media.attr('controls', 'controls');

        // attempt to fix iOS 3 bug
        //t.$media.removeAttr('poster');
        // no Issue found on iOS3 -ttroxell

        // override Apple's autoplay override for iPads
        if (mf.isiPad && t.media.getAttribute('autoplay') !== null) {
          t.play();
        }

      } else if (mf.isAndroid && t.options.AndroidUseNativeControls) {

        // leave default player

      } else {

        // DESKTOP: use MediaElementPlayer controls

        // remove native controls
        t.$media.removeAttr('controls');
        var videoPlayerTitle = t.isVideo ?
          'Video Player' : 'Audio Player';
        // insert description for screen readers
        $('<span class="mejs-offscreen">' + videoPlayerTitle + '</span>').insertBefore(t.$media);
        // build container
        t.container =
          $('<div id="' + t.id + '" class="mejs-container ' + (mejs.MediaFeatures.svg ? 'svg' : 'no-svg') +
            '" tabindex="0" role="application" aria-label="' + videoPlayerTitle + '">' +
            '<div class="mejs-inner">' +
            '<div class="mejs-mediaelement"></div>' +
            '<div class="mejs-layers"></div>' +
            '<div class="mejs-controls"></div>' +
            '<div class="mejs-clear"></div>' +
            '</div>' +
            '</div>')
          .addClass(t.$media[0].className)
          .insertBefore(t.$media)
          .focus(function (e) {
            if (!t.controlsAreVisible) {
              t.showControls(true);
              var playButton = t.container.find('.mejs-playpause-button > button');
              playButton.focus();
            }
          });

        // add classes for user and content
        t.container.addClass(
          (mf.isAndroid ? 'mejs-android ' : '') +
          (mf.isiOS ? 'mejs-ios ' : '') +
          (mf.isiPad ? 'mejs-ipad ' : '') +
          (mf.isiPhone ? 'mejs-iphone ' : '') +
          (t.isVideo ? 'mejs-video ' : 'mejs-audio ')
          );


        // move the <video/video> tag into the right spot
        if (mf.isiOS) {

          // sadly, you can't move nodes in iOS, so we have to destroy and recreate it!
          var $newMedia = t.$media.clone();

          t.container.find('.mejs-mediaelement').append($newMedia);

          t.$media.remove();
          t.$node = t.$media = $newMedia;
          t.node = t.media = $newMedia[0];

        } else {

          // normal way of moving it into place (doesn't work on iOS)
          t.container.find('.mejs-mediaelement').append(t.$media);
        }

        // find parts
        t.controls = t.container.find('.mejs-controls');
        t.layers = t.container.find('.mejs-layers');

        // determine the size

        /* size priority:
         (1) videoWidth (forced),
         (2) style="width;height;"
         (3) width attribute,
         (4) defaultVideoWidth (for unspecified cases)
         */

        var tagType = (t.isVideo ? 'video' : 'audio'),
          capsTagName = tagType.substring(0, 1).toUpperCase() + tagType.substring(1);



        if (t.options[tagType + 'Width'] > 0 || t.options[tagType + 'Width'].toString().indexOf('%') > -1) {
          t.width = t.options[tagType + 'Width'];
        } else if (t.media.style.width !== '' && t.media.style.width !== null) {
          t.width = t.media.style.width;
        } else if (t.media.getAttribute('width') !== null) {
          t.width = t.$media.attr('width');
        } else {
          t.width = t.options['default' + capsTagName + 'Width'];
        }

        if (t.options[tagType + 'Height'] > 0 || t.options[tagType + 'Height'].toString().indexOf('%') > -1) {
          t.height = t.options[tagType + 'Height'];
        } else if (t.media.style.height !== '' && t.media.style.height !== null) {
          t.height = t.media.style.height;
        } else if (t.$media[0].getAttribute('height') !== null) {
          t.height = t.$media.attr('height');
        } else {
          t.height = t.options['default' + capsTagName + 'Height'];
        }

        // set the size, while we wait for the plugins to load below
        t.setPlayerSize(t.width, t.height);

        // create MediaElementShim
        meOptions.pluginWidth = t.width;
        meOptions.pluginHeight = t.height;
      }

      // create MediaElement shim
      mejs.MediaElement(t.$media[0], meOptions);

      if (typeof (t.container) != 'undefined' && t.controlsAreVisible) {
        // controls are shown when loaded
        t.container.trigger('controlsshown');
      }
    },
    showControls: function (doAnimation) {
      var t = this;

      doAnimation = typeof doAnimation == 'undefined' || doAnimation;

      if (t.controlsAreVisible)
        return;

      if (doAnimation) {
        t.controls
          .css('visibility', 'visible')
          .stop(true, true).fadeIn(200, function () {
          t.controlsAreVisible = true;
          t.container.trigger('controlsshown');
        });

        // any additional controls people might add and want to hide
        t.container.find('.mejs-control')
          .css('visibility', 'visible')
          .stop(true, true).fadeIn(200, function () {
          t.controlsAreVisible = true;
        });

      } else {
        t.controls
          .css('visibility', 'visible')
          .css('display', 'block');

        // any additional controls people might add and want to hide
        t.container.find('.mejs-control')
          .css('visibility', 'visible')
          .css('display', 'block');

        t.controlsAreVisible = true;
        t.container.trigger('controlsshown');
      }

      t.setControlsSize();

    },
    hideControls: function (doAnimation) {
      var t = this;

      doAnimation = typeof doAnimation == 'undefined' || doAnimation;

      if (!t.controlsAreVisible || t.options.alwaysShowControls || t.keyboardAction)
        return;

      if (doAnimation) {
        // fade out main controls
        t.controls.stop(true, true).fadeOut(200, function () {
          $(this)
            .css('visibility', 'hidden')
            .css('display', 'block');

          t.controlsAreVisible = false;
          t.container.trigger('controlshidden');
        });

        // any additional controls people might add and want to hide
        t.container.find('.mejs-control').stop(true, true).fadeOut(200, function () {
          $(this)
            .css('visibility', 'hidden')
            .css('display', 'block');
        });
      } else {

        // hide main controls
        t.controls
          .css('visibility', 'hidden')
          .css('display', 'block');

        // hide others
        t.container.find('.mejs-control')
          .css('visibility', 'hidden')
          .css('display', 'block');

        t.controlsAreVisible = false;
        t.container.trigger('controlshidden');
      }
    },
    controlsTimer: null,
    startControlsTimer: function (timeout) {

      var t = this;

      timeout = typeof timeout != 'undefined' ? timeout : 1500;

      t.killControlsTimer('start');

      t.controlsTimer = setTimeout(function () {
        //console.log('timer fired');
        t.hideControls();
        t.killControlsTimer('hide');
      }, timeout);
    },
    killControlsTimer: function (src) {

      var t = this;

      if (t.controlsTimer !== null) {
        clearTimeout(t.controlsTimer);
        delete t.controlsTimer;
        t.controlsTimer = null;
      }
    },
    controlsEnabled: true,
    disableControls: function () {
      var t = this;

      t.killControlsTimer();
      t.hideControls(false);
      this.controlsEnabled = false;
    },
    enableControls: function () {
      var t = this;

      t.showControls(false);

      t.controlsEnabled = true;
    },
    // Sets up all controls and events
    meReady: function (media, domNode) {


      var t = this,
        mf = mejs.MediaFeatures,
        autoplayAttr = domNode.getAttribute('autoplay'),
        autoplay = !(typeof autoplayAttr == 'undefined' || autoplayAttr === null || autoplayAttr === 'false'),
        featureIndex,
        feature;

      // make sure it can't create itself again if a plugin reloads
      if (t.created) {
        return;
      } else {
        t.created = true;
      }

      t.media = media;
      t.domNode = domNode;

      if (!(mf.isAndroid && t.options.AndroidUseNativeControls) && !(mf.isiPad && t.options.iPadUseNativeControls) && !(mf.isiPhone && t.options.iPhoneUseNativeControls)) {

        // two built in features
        t.buildposter(t, t.controls, t.layers, t.media);
        t.buildkeyboard(t, t.controls, t.layers, t.media);
        t.buildoverlays(t, t.controls, t.layers, t.media);

        // grab for use by features
        t.findTracks();

        // add user-defined features/controls
        for (featureIndex in t.options.features) {
          feature = t.options.features[featureIndex];
          if (t['build' + feature]) {
            try {
              t['build' + feature](t, t.controls, t.layers, t.media);
            } catch (e) {
              // TODO: report control error
              //throw e;
              console.log('error building ' + feature);
              console.log(e);
            }
          }
        }

        t.container.trigger('controlsready');

        // reset all layers and controls
        t.setPlayerSize(t.width, t.height);
        t.setControlsSize();


        // controls fade
        if (t.isVideo) {

          if (mejs.MediaFeatures.hasTouch) {

            // for touch devices (iOS, Android)
            // show/hide without animation on touch

            t.$media.bind('touchstart', function () {


              // toggle controls
              if (t.controlsAreVisible) {
                t.hideControls(false);
              } else {
                if (t.controlsEnabled) {
                  t.showControls(false);
                }
              }
            });

          } else {

            // create callback here since it needs access to current
            // MediaElement object
            t.clickToPlayPauseCallback = function () {
              //console.log('media clicked', t.media, t.media.paused);

              if (t.options.clickToPlayPause) {
                if (t.media.paused) {
                  t.play();
                } else {
                  t.pause();
                }
              }
            };

            // click to play/pause
            t.media.addEventListener('click', t.clickToPlayPauseCallback, false);

            // show/hide controls
            t.container
              .bind('mouseenter mouseover', function () {
                if (t.controlsEnabled) {
                  if (!t.options.alwaysShowControls) {
                    t.killControlsTimer('enter');
                    t.showControls();
                    t.startControlsTimer(2500);
                  }
                }
              })
              .bind('mousemove', function () {
                if (t.controlsEnabled) {
                  if (!t.controlsAreVisible) {
                    t.showControls();
                  }
                  if (!t.options.alwaysShowControls) {
                    t.startControlsTimer(2500);
                  }
                }
              })
              .bind('mouseleave', function () {
                if (t.controlsEnabled) {
                  if (!t.media.paused && !t.options.alwaysShowControls) {
                    t.startControlsTimer(1000);
                  }
                }
              });
          }

          if (t.options.hideVideoControlsOnLoad) {
            t.hideControls(false);
          }

          // check for autoplay
          if (autoplay && !t.options.alwaysShowControls) {
            t.hideControls();
          }

          // resizer
          if (t.options.enableAutosize) {
            t.media.addEventListener('loadedmetadata', function (e) {
              // if the <video height> was not set and the options.videoHeight was not set
              // then resize to the real dimensions
              if (t.options.videoHeight <= 0 && t.domNode.getAttribute('height') === null && !isNaN(e.target.videoHeight)) {
                t.setPlayerSize(e.target.videoWidth, e.target.videoHeight);
                t.setControlsSize();
                t.media.setVideoSize(e.target.videoWidth, e.target.videoHeight);
              }
            }, false);
          }
        }

        // EVENTS

        // FOCUS: when a video starts playing, it takes focus from other players (possibily pausing them)
        media.addEventListener('play', function () {
          var playerIndex;

          // go through all other players
          for (playerIndex in mejs.players) {
            var p = mejs.players[playerIndex];
            if (p.id != t.id && t.options.pauseOtherPlayers && !p.paused && !p.ended) {
              p.pause();
            }
            p.hasFocus = false;
          }

          t.hasFocus = true;
        }, false);


        // ended for all
        t.media.addEventListener('ended', function (e) {
          if (t.options.autoRewind) {
            try {
              t.media.setCurrentTime(0);
              // Fixing an Android stock browser bug, where "seeked" isn't fired correctly after ending the video and jumping to the beginning
              window.setTimeout(function () {
                $(t.container).find('.mejs-overlay-loading').parent().hide();
              }, 20);
            } catch (exp) {

            }
          }
          t.media.pause();

          if (t.setProgressRail) {
            t.setProgressRail();
          }
          if (t.setCurrentRail) {
            t.setCurrentRail();
          }

          if (t.options.loop) {
            t.play();
          } else if (!t.options.alwaysShowControls && t.controlsEnabled) {
            t.showControls();
          }
        }, false);

        // resize on the first play
        t.media.addEventListener('loadedmetadata', function (e) {
          if (t.updateDuration) {
            t.updateDuration();
          }
          if (t.updateCurrent) {
            t.updateCurrent();
          }

          if (!t.isFullScreen) {
            t.setPlayerSize(t.width, t.height);
            t.setControlsSize();
          }
        }, false);

        t.container.focusout(function (e) {
          if (e.relatedTarget) { //FF is working on supporting focusout https://bugzilla.mozilla.org/show_bug.cgi?id=687787
            var $target = $(e.relatedTarget);
            if (t.keyboardAction && $target.parents('.mejs-container').length === 0) {
              t.keyboardAction = false;
              t.hideControls(true);
            }
          }
        });

        // webkit has trouble doing this without a delay
        setTimeout(function () {
          t.setPlayerSize(t.width, t.height);
          t.setControlsSize();
        }, 50);

        // adjust controls whenever window sizes (used to be in fullscreen only)
        t.globalBind('resize', function () {

          // don't resize for fullscreen mode
          if (!(t.isFullScreen || (mejs.MediaFeatures.hasTrueNativeFullScreen && document.webkitIsFullScreen))) {
            t.setPlayerSize(t.width, t.height);
          }

          // always adjust controls
          t.setControlsSize();
        });

        // This is a work-around for a bug in the YouTube iFrame player, which means
        //  we can't use the play() API for the initial playback on iOS or Android;
        //  user has to start playback directly by tapping on the iFrame.
        if (t.media.pluginType == 'youtube' && (mf.isiOS || mf.isAndroid)) {
          t.container.find('.mejs-overlay-play').hide();
        }
      }

      // force autoplay for HTML5
      if (autoplay && media.pluginType == 'native') {
        t.play();
      }


      if (t.options.success) {

        if (typeof t.options.success == 'string') {
          window[t.options.success](t.media, t.domNode, t);
        } else {
          t.options.success(t.media, t.domNode, t);
        }
      }
    },
    handleError: function (e) {
      var t = this;

      t.controls.hide();

      // Tell user that the file cannot be played
      if (t.options.error) {
        t.options.error(e);
      }
    },
    setPlayerSize: function (width, height) {
      var t = this;

      if (!t.options.setDimensions) {
        return false;
      }

      if (typeof width != 'undefined') {
        t.width = width;
      }

      if (typeof height != 'undefined') {
        t.height = height;
      }

      // detect 100% mode - use currentStyle for IE since css() doesn't return percentages
      if (t.height.toString().indexOf('%') > 0 || t.$node.css('max-width') === '100%' || (t.$node[0].currentStyle && t.$node[0].currentStyle.maxWidth === '100%')) {

        // do we have the native dimensions yet?
        var nativeWidth = (function () {
          if (t.isVideo) {
            if (t.media.videoWidth && t.media.videoWidth > 0) {
              return t.media.videoWidth;
            } else if (t.media.getAttribute('width') !== null) {
              return t.media.getAttribute('width');
            } else {
              return t.options.defaultVideoWidth;
            }
          } else {
            return t.options.defaultAudioWidth;
          }
        })();

        var nativeHeight = (function () {
          if (t.isVideo) {
            if (t.media.videoHeight && t.media.videoHeight > 0) {
              return t.media.videoHeight;
            } else if (t.media.getAttribute('height') !== null) {
              return t.media.getAttribute('height');
            } else {
              return t.options.defaultVideoHeight;
            }
          } else {
            return t.options.defaultAudioHeight;
          }
        })();

        var
          parentWidth = t.container.parent().closest(':visible').width(),
          parentHeight = t.container.parent().closest(':visible').height(),
          newHeight = t.isVideo || !t.options.autosizeProgress ? parseInt(parentWidth * nativeHeight / nativeWidth, 10) : nativeHeight;

        // When we use percent, the newHeight can't be calculated so we get the container height
        if (isNaN(newHeight)) {
          newHeight = parentHeight;
        }

        if (t.container.parent()[0].tagName.toLowerCase() === 'body') { // && t.container.siblings().count == 0) {
          parentWidth = $(window).width();
          newHeight = $(window).height();
        }

        if (newHeight && parentWidth) {

          // set outer container size
          t.container
            .width(parentWidth)
            .height(newHeight);

          // set native <video> or <audio> and shims
          t.$media.add(t.container.find('.mejs-shim'))
            .width('100%')
            .height('100%');

          // if shim is ready, send the size to the embeded plugin
          if (t.isVideo) {
            if (t.media.setVideoSize) {
              t.media.setVideoSize(parentWidth, newHeight);
            }
          }

          // set the layers
          t.layers.children('.mejs-layer')
            .width('100%')
            .height('100%');
        }


      } else {

        t.container
          .width(t.width)
          .height(t.height);

        t.layers.children('.mejs-layer')
          .width(t.width)
          .height(t.height);

      }

      // special case for big play button so it doesn't go over the controls area
      var playLayer = t.layers.find('.mejs-overlay-play'),
        playButton = playLayer.find('.mejs-overlay-button');

      playLayer.height(t.container.height() - t.controls.height());
      playButton.css('margin-top', '-' + (playButton.height() / 2 - t.controls.height() / 2).toString() + 'px');

    },
    setControlsSize: function () {
      var t = this,
        usedWidth = 0,
        railWidth = 0,
        rail = t.controls.find('.mejs-time-rail'),
        total = t.controls.find('.mejs-time-total'),
        current = t.controls.find('.mejs-time-current'),
        loaded = t.controls.find('.mejs-time-loaded'),
        others = rail.siblings(),
        lastControl = others.last(),
        lastControlPosition = null;

      // skip calculation if hidden
      if (!t.container.is(':visible') || !rail.length || !rail.is(':visible')) {
        return;
      }


      // allow the size to come from custom CSS
      if (t.options && !t.options.autosizeProgress) {
        // Also, frontends devs can be more flexible
        // due the opportunity of absolute positioning.
        railWidth = parseInt(rail.css('width'), 10);
      }

      // attempt to autosize
      if (railWidth === 0 || !railWidth) {

        // find the size of all the other controls besides the rail
        others.each(function () {
          var $this = $(this);
          if ($this.css('position') != 'absolute' && $this.is(':visible')) {
            usedWidth += $(this).outerWidth(true);
          }
        });

        // fit the rail into the remaining space
        railWidth = t.controls.width() - usedWidth - (rail.outerWidth(true) - rail.width());
      }

      // resize the rail,
      // but then check if the last control (say, the fullscreen button) got pushed down
      // this often happens when zoomed
      do {
        // outer area
        rail.width(railWidth);
        // dark space
        total.width(railWidth - (total.outerWidth(true) - total.width()));

        if (lastControl.css('position') != 'absolute') {
          lastControlPosition = lastControl.position();
          railWidth--;
        }
      } while (lastControlPosition !== null && lastControlPosition.top > 0 && railWidth > 0);

      if (t.setProgressRail)
        t.setProgressRail();
      if (t.setCurrentRail)
        t.setCurrentRail();
    },
    buildposter: function (player, controls, layers, media) {
      var t = this,
        poster =
        $('<div class="mejs-poster mejs-layer">' +
          '</div>')
        .appendTo(layers),
        posterUrl = player.$media.attr('poster');

      // prioriy goes to option (this is useful if you need to support iOS 3.x (iOS completely fails with poster)
      if (player.options.poster !== '') {
        posterUrl = player.options.poster;
      }

      // second, try the real poster
      if (posterUrl) {
        t.setPoster(posterUrl);
      } else {
        poster.hide();
      }

      media.addEventListener('play', function () {
        poster.hide();
      }, false);

      if (player.options.showPosterWhenEnded && player.options.autoRewind) {
        media.addEventListener('ended', function () {
          poster.show();
        }, false);
      }
    },
    setPoster: function (url) {
      var t = this,
        posterDiv = t.container.find('.mejs-poster'),
        posterImg = posterDiv.find('img');

      if (posterImg.length === 0) {
        posterImg = $('<img width="100%" height="100%" />').appendTo(posterDiv);
      }

      posterImg.attr('src', url);
      posterDiv.css({'background-image': 'url(' + url + ')'});
    },
    buildoverlays: function (player, controls, layers, media) {
      var t = this;
      if (!player.isVideo)
        return;

      var
        loading =
        $('<div class="mejs-overlay mejs-layer">' +
          '<div class="mejs-overlay-loading"><span></span></div>' +
          '</div>')
        .hide() // start out hidden
        .appendTo(layers),
        error =
        $('<div class="mejs-overlay mejs-layer">' +
          '<div class="mejs-overlay-error"></div>' +
          '</div>')
        .hide() // start out hidden
        .appendTo(layers),
        // this needs to come last so it's on top
        bigPlay =
        $('<div class="mejs-overlay mejs-layer mejs-overlay-play">' +
          '<div class="mejs-overlay-button"></div>' +
          '</div>')
        .appendTo(layers)
        .bind('click', function () {  // Removed 'touchstart' due issues on Samsung Android devices where a tap on bigPlay started and immediately stopped the video
          if (t.options.clickToPlayPause) {
            if (media.paused) {
              media.play();
            }
          }
        });

      /*
       if (mejs.MediaFeatures.isiOS || mejs.MediaFeatures.isAndroid) {
       bigPlay.remove();
       loading.remove();
       }
       */


      // show/hide big play button
      media.addEventListener('play', function () {
        bigPlay.hide();
        loading.hide();
        controls.find('.mejs-time-buffering').hide();
        error.hide();
      }, false);

      media.addEventListener('playing', function () {
        bigPlay.hide();
        loading.hide();
        controls.find('.mejs-time-buffering').hide();
        error.hide();
      }, false);

      media.addEventListener('seeking', function () {
        loading.show();
        controls.find('.mejs-time-buffering').show();
      }, false);

      media.addEventListener('seeked', function () {
        loading.hide();
        controls.find('.mejs-time-buffering').hide();
      }, false);

      media.addEventListener('pause', function () {
        if (!mejs.MediaFeatures.isiPhone) {
          bigPlay.show();
        }
      }, false);

      media.addEventListener('waiting', function () {
        loading.show();
        controls.find('.mejs-time-buffering').show();
      }, false);


      // show/hide loading
      media.addEventListener('loadeddata', function () {
        // for some reason Chrome is firing this event
        //if (mejs.MediaFeatures.isChrome && media.getAttribute && media.getAttribute('preload') === 'none')
        //	return;

        loading.show();
        controls.find('.mejs-time-buffering').show();
        // Firing the 'canplay' event after a timeout which isn't getting fired on some Android 4.1 devices (https://github.com/johndyer/mediaelement/issues/1305)
        if (mejs.MediaFeatures.isAndroid) {
          media.canplayTimeout = window.setTimeout(
            function () {
              if (document.createEvent) {
                var evt = document.createEvent('HTMLEvents');
                evt.initEvent('canplay', true, true);
                return media.dispatchEvent(evt);
              }
            }, 300
            );
        }
      }, false);
      media.addEventListener('canplay', function () {
        loading.hide();
        controls.find('.mejs-time-buffering').hide();
        clearTimeout(media.canplayTimeout); // Clear timeout inside 'loadeddata' to prevent 'canplay' to fire twice
      }, false);

      // error handling
      media.addEventListener('error', function () {
        loading.hide();
        controls.find('.mejs-time-buffering').hide();
        error.show();
        error.find('mejs-overlay-error').html("Error loading this resource");
      }, false);

      media.addEventListener('keydown', function (e) {
        t.onkeydown(player, media, e);
      }, false);
    },
    buildkeyboard: function (player, controls, layers, media) {

      var t = this;

      t.container.keydown(function () {
        t.keyboardAction = true;
      });

      // listen for key presses
      t.globalBind('keydown', function (e) {
        return t.onkeydown(player, media, e);
      });


      // check if someone clicked outside a player region, then kill its focus
      t.globalBind('click', function (event) {
        player.hasFocus = $(event.target).closest('.mejs-container').length !== 0;
      });

    },
    onkeydown: function (player, media, e) {
      if (player.hasFocus && player.options.enableKeyboard) {
        // find a matching key
        for (var i = 0, il = player.options.keyActions.length; i < il; i++) {
          var keyAction = player.options.keyActions[i];

          for (var j = 0, jl = keyAction.keys.length; j < jl; j++) {
            if (e.keyCode == keyAction.keys[j]) {
              if (typeof (e.preventDefault) == "function")
                e.preventDefault();
              keyAction.action(player, media, e.keyCode);
              return false;
            }
          }
        }
      }

      return true;
    },
    findTracks: function () {
      var t = this,
        tracktags = t.$media.find('track');

      // store for use by plugins
      t.tracks = [];
      tracktags.each(function (index, track) {

        track = $(track);

        t.tracks.push({
          srclang: (track.attr('srclang')) ? track.attr('srclang').toLowerCase() : '',
          src: track.attr('src'),
          kind: track.attr('kind'),
          label: track.attr('label') || '',
          entries: [],
          isLoaded: false
        });
      });
    },
    changeSkin: function (className) {
      this.container[0].className = 'mejs-container ' + className;
      this.setPlayerSize(this.width, this.height);
      this.setControlsSize();
    },
    play: function () {
      this.load();
      this.media.play();
    },
    pause: function () {
      try {
        this.media.pause();
      } catch (e) {
      }
    },
    load: function () {
      if (!this.isLoaded) {
        this.media.load();
      }

      this.isLoaded = true;
    },
    setMuted: function (muted) {
      this.media.setMuted(muted);
    },
    setCurrentTime: function (time) {
      this.media.setCurrentTime(time);
    },
    getCurrentTime: function () {
      return this.media.currentTime;
    },
    setVolume: function (volume) {
      this.media.setVolume(volume);
    },
    getVolume: function () {
      return this.media.volume;
    },
    setSrc: function (src) {
      this.media.setSrc(src);
    },
    remove: function () {
      var t = this, featureIndex, feature;

      // invoke features cleanup
      for (featureIndex in t.options.features) {
        feature = t.options.features[featureIndex];
        if (t['clean' + feature]) {
          try {
            t['clean' + feature](t);
          } catch (e) {
            // TODO: report control error
            //throw e;
            //console.log('error building ' + feature);
            //console.log(e);
          }
        }
      }

      // grab video and put it back in place
      if (!t.isDynamic) {
        t.$media.prop('controls', true);
        // detach events from the video
        // TODO: detach event listeners better than this;
        //       also detach ONLY the events attached by this plugin!
        t.$node.clone().insertBefore(t.container).show();
        t.$node.remove();
      } else {
        t.$node.insertBefore(t.container);
      }

      if (t.media.pluginType !== 'native') {
        t.media.remove();
      }

      // Remove the player from the mejs.players object so that pauseOtherPlayers doesn't blow up when trying to pause a non existance flash api.
      delete mejs.players[t.id];

      if (typeof t.container == 'object') {
        t.container.remove();
      }
      t.globalUnbind();
      delete t.node.player;
    },
    rebuildtracks: function () {
      var t = this;
      t.findTracks();
      t.buildtracks(t, t.controls, t.layers, t.media);
    }
  };

  (function () {
    var rwindow = /^((after|before)print|(before)?unload|hashchange|message|o(ff|n)line|page(hide|show)|popstate|resize|storage)\b/;

    function splitEvents(events, id) {
      // add player ID as an event namespace so it's easier to unbind them all later
      var ret = {d: [], w: []};
      $.each((events || '').split(' '), function (k, v) {
        var eventname = v + '.' + id;
        if (eventname.indexOf('.') === 0) {
          ret.d.push(eventname);
          ret.w.push(eventname);
        }
        else {
          ret[rwindow.test(v) ? 'w' : 'd'].push(eventname);
        }
      });
      ret.d = ret.d.join(' ');
      ret.w = ret.w.join(' ');
      return ret;
    }

    mejs.MediaElementPlayer.prototype.globalBind = function (events, data, callback) {
      var t = this;
      events = splitEvents(events, t.id);
      if (events.d)
        $(document).bind(events.d, data, callback);
      if (events.w)
        $(window).bind(events.w, data, callback);
    };

    mejs.MediaElementPlayer.prototype.globalUnbind = function (events, callback) {
      var t = this;
      events = splitEvents(events, t.id);
      if (events.d)
        $(document).unbind(events.d, callback);
      if (events.w)
        $(window).unbind(events.w, callback);
    };
  })();

  // turn into jQuery plugin
  if (typeof $ != 'undefined') {
    $.fn.mediaelementplayer = function (options) {
      if (options === false) {
        this.each(function () {
          var player = $(this).data('mediaelementplayer');
          if (player) {
            player.remove();
          }
          $(this).removeData('mediaelementplayer');
        });
      }
      else {
        this.each(function () {
          $(this).data('mediaelementplayer', new mejs.MediaElementPlayer(this, options));
        });
      }
      return this;
    };


    $(document).ready(function () {
      // auto enable using JSON attribute
      $('.mejs-player').mediaelementplayer();
    });
  }

  // push out to window
  window.MediaElementPlayer = mejs.MediaElementPlayer;

})(mejs.$);

(function ($) {

  $.extend(mejs.MepDefaults, {
    playText: 'Play',
    pauseText: 'Pause'
  });

  // PLAY/pause BUTTON
  $.extend(MediaElementPlayer.prototype, {
    buildplaypause: function (player, controls, layers, media) {
      var
        t = this,
        op = t.options,
        play =
        $('<div class="mejs-button mejs-playpause-button mejs-play" >' +
          '<button type="button" aria-controls="' + t.id + '" title="' + op.playText + '" aria-label="' + op.playText + '"></button>' +
          '</div>')
        .appendTo(controls)
        .click(function (e) {
          e.preventDefault();

          if (media.paused) {
            media.play();
          } else {
            media.pause();
          }

          return false;
        }),
        play_btn = play.find('button');


      function togglePlayPause(which) {
        if ('play' === which) {
          play.removeClass('mejs-play').addClass('mejs-pause');
          play_btn.attr({
            'title': op.pauseText,
            'aria-label': op.pauseText
          });
        } else {
          play.removeClass('mejs-pause').addClass('mejs-play');
          play_btn.attr({
            'title': op.playText,
            'aria-label': op.playText
          });
        }
      }
      ;
      togglePlayPause('pse');


      media.addEventListener('play', function () {
        togglePlayPause('play');
      }, false);
      media.addEventListener('playing', function () {
        togglePlayPause('play');
      }, false);


      media.addEventListener('pause', function () {
        togglePlayPause('pse');
      }, false);
      media.addEventListener('paused', function () {
        togglePlayPause('pse');
      }, false);
    }
  });

})(mejs.$);

(function ($) {

  $.extend(mejs.MepDefaults, {
    progessHelpText: 'Use Left/Right Arrow keys to advance one second, Up/Down arrows to advance ten seconds.'
  });

  // progress/loaded bar
  $.extend(MediaElementPlayer.prototype, {
    buildprogress: function (player, controls, layers, media) {

      $('<div class="mejs-time-rail">' +
        '<span  class="mejs-time-total mejs-time-slider">' +
        //'<span class="mejs-offscreen">' + this.options.progessHelpText + '</span>' +
        '<span class="mejs-time-buffering"></span>' +
        '<span class="mejs-time-loaded"></span>' +
        '<span class="mejs-time-current"></span>' +
        '<span class="mejs-time-handle"></span>' +
        '<span class="mejs-time-float">' +
        '<span class="mejs-time-float-current">00:00</span>' +
        '<span class="mejs-time-float-corner"></span>' +
        '</span>' +
        '</div>')
        .appendTo(controls);
      controls.find('.mejs-time-buffering').hide();

      var
        t = this,
        total = controls.find('.mejs-time-total'),
        loaded = controls.find('.mejs-time-loaded'),
        current = controls.find('.mejs-time-current'),
        handle = controls.find('.mejs-time-handle'),
        timefloat = controls.find('.mejs-time-float'),
        timefloatcurrent = controls.find('.mejs-time-float-current'),
        slider = controls.find('.mejs-time-slider'),
        handleMouseMove = function (e) {

          var offset = total.offset(),
            width = total.outerWidth(true),
            percentage = 0,
            newTime = 0,
            pos = 0,
            x;

          // mouse or touch position relative to the object
          if (e.originalEvent.changedTouches) {
            x = e.originalEvent.changedTouches[0].pageX;
          } else {
            x = e.pageX;
          }

          if (media.duration) {
            if (x < offset.left) {
              x = offset.left;
            } else if (x > width + offset.left) {
              x = width + offset.left;
            }

            pos = x - offset.left;
            percentage = (pos / width);
            newTime = (percentage <= 0.02) ? 0 : percentage * media.duration;

            // seek to where the mouse is
            if (mouseIsDown && newTime !== media.currentTime) {
              media.setCurrentTime(newTime);
            }

            // position floating time box
            if (!mejs.MediaFeatures.hasTouch) {
              timefloat.css('left', pos);
              timefloatcurrent.html(mejs.Utility.secondsToTimeCode(newTime));
              timefloat.show();
            }
          }
        },
        mouseIsDown = false,
        mouseIsOver = false,
        lastKeyPressTime = 0,
        startedPaused = false,
        autoRewindInitial = player.options.autoRewind;
      // Accessibility for slider
      var updateSlider = function (e) {

        var seconds = media.currentTime,
          timeSliderText = 'Time Slider',
          time = mejs.Utility.secondsToTimeCode(seconds),
          duration = media.duration;

        slider.attr({
          'aria-label': timeSliderText,
          'aria-valuemin': 0,
          'aria-valuemax': duration,
          'aria-valuenow': seconds,
          'aria-valuetext': time,
          'role': 'slider',
          'tabindex': 0
        });

      };

      var restartPlayer = function () {
        var now = new Date();
        if (now - lastKeyPressTime >= 1000) {
          media.play();
        }
      };

      slider.bind('focus', function (e) {
        player.options.autoRewind = false;
      });

      slider.bind('blur', function (e) {
        player.options.autoRewind = autoRewindInitial;
      });

      slider.bind('keydown', function (e) {

        if ((new Date() - lastKeyPressTime) >= 1000) {
          startedPaused = media.paused;
        }

        var keyCode = e.keyCode,
          duration = media.duration,
          seekTime = media.currentTime;

        switch (keyCode) {
          case 37: // left
            seekTime -= 1;
            break;
          case 39: // Right
            seekTime += 1;
            break;
          case 38: // Up
            seekTime += Math.floor(duration * 0.1);
            break;
          case 40: // Down
            seekTime -= Math.floor(duration * 0.1);
            break;
          case 36: // Home
            seekTime = 0;
            break;
          case 35: // end
            seekTime = duration;
            break;
          case 10: // enter
            media.paused ? media.play() : media.pause();
            return;
          case 13: // space
            media.paused ? media.play() : media.pause();
            return;
          default:
            return;
        }

        seekTime = seekTime < 0 ? 0 : (seekTime >= duration ? duration : Math.floor(seekTime));
        lastKeyPressTime = new Date();
        if (!startedPaused) {
          media.pause();
        }

        if (seekTime < media.duration && !startedPaused) {
          setTimeout(restartPlayer, 1100);
        }

        media.setCurrentTime(seekTime);

        e.preventDefault();
        e.stopPropagation();
        return false;
      });


      // handle clicks
      //controls.find('.mejs-time-rail').delegate('span', 'click', handleMouseMove);
      total
        .bind('mousedown touchstart', function (e) {
          // only handle left clicks or touch
          if (e.which === 1 || e.which === 0) {
            mouseIsDown = true;
            handleMouseMove(e);
            t.globalBind('mousemove.dur touchmove.dur', function (e) {
              handleMouseMove(e);
            });
            t.globalBind('mouseup.dur touchend.dur', function (e) {
              mouseIsDown = false;
              timefloat.hide();
              t.globalUnbind('.dur');
            });
          }
        })
        .bind('mouseenter', function (e) {
          mouseIsOver = true;
          t.globalBind('mousemove.dur', function (e) {
            handleMouseMove(e);
          });
          if (!mejs.MediaFeatures.hasTouch) {
            timefloat.show();
          }
        })
        .bind('mouseleave', function (e) {
          mouseIsOver = false;
          if (!mouseIsDown) {
            t.globalUnbind('.dur');
            timefloat.hide();
          }
        });

      // loading
      media.addEventListener('progress', function (e) {
        player.setProgressRail(e);
        player.setCurrentRail(e);
      }, false);

      // current time
      media.addEventListener('timeupdate', function (e) {
        player.setProgressRail(e);
        player.setCurrentRail(e);
        updateSlider(e);
      }, false);


      // store for later use
      t.loaded = loaded;
      t.total = total;
      t.current = current;
      t.handle = handle;
    },
    setProgressRail: function (e) {

      var
        t = this,
        target = (e !== undefined) ? e.target : t.media,
        percent = null;

      // newest HTML5 spec has buffered array (FF4, Webkit)
      if (target && target.buffered && target.buffered.length > 0 && target.buffered.end && target.duration) {
        // TODO: account for a real array with multiple values (only Firefox 4 has this so far)
        percent = target.buffered.end(0) / target.duration;
      }
      // Some browsers (e.g., FF3.6 and Safari 5) cannot calculate target.bufferered.end()
      // to be anything other than 0. If the byte count is available we use this instead.
      // Browsers that support the else if do not seem to have the bufferedBytes value and
      // should skip to there. Tested in Safari 5, Webkit head, FF3.6, Chrome 6, IE 7/8.
      else if (target && target.bytesTotal !== undefined && target.bytesTotal > 0 && target.bufferedBytes !== undefined) {
        percent = target.bufferedBytes / target.bytesTotal;
      }
      // Firefox 3 with an Ogg file seems to go this way
      else if (e && e.lengthComputable && e.total !== 0) {
        percent = e.loaded / e.total;
      }

      // finally update the progress bar
      if (percent !== null) {
        percent = Math.min(1, Math.max(0, percent));
        // update loaded bar
        if (t.loaded && t.total) {
          t.loaded.width(t.total.width() * percent);
        }
      }
    },
    setCurrentRail: function () {

      var t = this;

      if (t.media.currentTime !== undefined && t.media.duration) {

        // update bar and handle
        if (t.total && t.handle) {
          var
            newWidth = Math.round(t.total.width() * t.media.currentTime / t.media.duration),
            handlePos = newWidth - Math.round(t.handle.outerWidth(true) / 2);

          t.current.width(newWidth);
          t.handle.css('left', handlePos);
        }
      }

    }
  });
})(mejs.$);
(function ($) {

  // options
  $.extend(mejs.MepDefaults, {
    duration: -1,
    timeAndDurationSeparator: '<span> | </span>'
  });


  // current and duration 00:00 / 00:00
  $.extend(MediaElementPlayer.prototype, {
    buildcurrent: function (player, controls, layers, media) {
      var t = this;

      $('<div class="mejs-time" role="timer" aria-live="off">' +
        '<span class="mejs-currenttime">' +
        (player.options.alwaysShowHours ? '00:' : '') +
        (player.options.showTimecodeFrameCount ? '00:00:00' : '00:00') +
        '</span>' +
        '</div>')
        .appendTo(controls);

      t.currenttime = t.controls.find('.mejs-currenttime');

      media.addEventListener('timeupdate', function () {
        player.updateCurrent();
      }, false);
    },
    buildduration: function (player, controls, layers, media) {
      var t = this;

      if (controls.children().last().find('.mejs-currenttime').length > 0) {
        $(t.options.timeAndDurationSeparator +
          '<span class="mejs-duration">' +
          (t.options.duration > 0 ?
            mejs.Utility.secondsToTimeCode(t.options.duration, t.options.alwaysShowHours || t.media.duration > 3600, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25) :
            ((player.options.alwaysShowHours ? '00:' : '') + (player.options.showTimecodeFrameCount ? '00:00:00' : '00:00'))
            ) +
          '</span>')
          .appendTo(controls.find('.mejs-time'));
      } else {

        // add class to current time
        controls.find('.mejs-currenttime').parent().addClass('mejs-currenttime-container');

        $('<div class="mejs-time mejs-duration-container">' +
          '<span class="mejs-duration">' +
          (t.options.duration > 0 ?
            mejs.Utility.secondsToTimeCode(t.options.duration, t.options.alwaysShowHours || t.media.duration > 3600, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25) :
            ((player.options.alwaysShowHours ? '00:' : '') + (player.options.showTimecodeFrameCount ? '00:00:00' : '00:00'))
            ) +
          '</span>' +
          '</div>')
          .appendTo(controls);
      }

      t.durationD = t.controls.find('.mejs-duration');

      media.addEventListener('timeupdate', function () {
        player.updateDuration();
      }, false);
    },
    updateCurrent: function () {
      var t = this;

      if (t.currenttime) {
        t.currenttime.html(mejs.Utility.secondsToTimeCode(t.media.currentTime, t.options.alwaysShowHours || t.media.duration > 3600, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25));
      }
    },
    updateDuration: function () {
      var t = this;

      //Toggle the long video class if the video is longer than an hour.
      t.container.toggleClass("mejs-long-video", t.media.duration > 3600);

      if (t.durationD && (t.options.duration > 0 || t.media.duration)) {
        t.durationD.html(mejs.Utility.secondsToTimeCode(t.options.duration > 0 ? t.options.duration : t.media.duration, t.options.alwaysShowHours, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25));
      }
    }
  });

})(mejs.$);

(function ($) {

  $.extend(mejs.MepDefaults, {
    muteText: 'Mute Toggle',
    allyVolumeControlText: 'Use Up/Down Arrow keys to increase or decrease volume.',
    hideVolumeOnTouchDevices: true,
    audioVolume: 'horizontal',
    videoVolume: 'vertical'
  });

  $.extend(MediaElementPlayer.prototype, {
    buildvolume: function (player, controls, layers, media) {

      // Android and iOS don't support volume controls
      if ((mejs.MediaFeatures.isAndroid || mejs.MediaFeatures.isiOS) && this.options.hideVolumeOnTouchDevices)
        return;

      var t = this,
        mode = (t.isVideo) ? t.options.videoVolume : t.options.audioVolume,
        mute = (mode == 'horizontal') ?
        // horizontal version
        $('<div class="mejs-button mejs-volume-button mejs-mute">' +
          '<button type="button" aria-controls="' + t.id +
          '" title="' + t.options.muteText +
          '" aria-label="' + t.options.muteText +
          '"></button>' +
          '</div>' +
          '<a href="javascript:void(0);" class="mejs-horizontal-volume-slider">' + // outer background
          '<span class="mejs-offscreen">' + t.options.allyVolumeControlText + '</span>' +
          '<div class="mejs-horizontal-volume-total"></div>' + // line background
          '<div class="mejs-horizontal-volume-current"></div>' + // current volume
          '<div class="mejs-horizontal-volume-handle"></div>' + // handle
          '</a>'
          )
        .appendTo(controls) :
        // vertical version
        $('<div class="mejs-button mejs-volume-button mejs-mute">' +
          '<button type="button" aria-controls="' + t.id +
          '" title="' + t.options.muteText +
          '" aria-label="' + t.options.muteText +
          '"></button>' +
          '<a href="javascript:void(0);" class="mejs-volume-slider">' + // outer background
          '<span class="mejs-offscreen">' + t.options.allyVolumeControlText + '</span>' +
          '<div class="mejs-volume-total"></div>' + // line background
          '<div class="mejs-volume-current"></div>' + // current volume
          '<div class="mejs-volume-handle"></div>' + // handle
          '</a>' +
          '</div>')
        .appendTo(controls),
        volumeSlider = t.container.find('.mejs-volume-slider, .mejs-horizontal-volume-slider'),
        volumeTotal = t.container.find('.mejs-volume-total, .mejs-horizontal-volume-total'),
        volumeCurrent = t.container.find('.mejs-volume-current, .mejs-horizontal-volume-current'),
        volumeHandle = t.container.find('.mejs-volume-handle, .mejs-horizontal-volume-handle'),
        positionVolumeHandle = function (volume, secondTry) {

          if (!volumeSlider.is(':visible') && typeof secondTry == 'undefined') {
            volumeSlider.show();
            positionVolumeHandle(volume, true);
            volumeSlider.hide();
            return;
          }

          // correct to 0-1
          volume = Math.max(0, volume);
          volume = Math.min(volume, 1);

          // ajust mute button style
          if (volume === 0) {
            mute.removeClass('mejs-mute').addClass('mejs-unmute');
          } else {
            mute.removeClass('mejs-unmute').addClass('mejs-mute');
          }

          // top/left of full size volume slider background
          var totalPosition = volumeTotal.position();
          // position slider
          if (mode == 'vertical') {
            var
              // height of the full size volume slider background
              totalHeight = volumeTotal.height(),
              // the new top position based on the current volume
              // 70% volume on 100px height == top:30px
              newTop = totalHeight - (totalHeight * volume);

            // handle
            volumeHandle.css('top', Math.round(totalPosition.top + newTop - (volumeHandle.height() / 2)));

            // show the current visibility
            volumeCurrent.height(totalHeight - newTop);
            volumeCurrent.css('top', totalPosition.top + newTop);
          } else {
            var
              // height of the full size volume slider background
              totalWidth = volumeTotal.width(),
              // the new left position based on the current volume
              newLeft = totalWidth * volume;

            // handle
            volumeHandle.css('left', Math.round(totalPosition.left + newLeft - (volumeHandle.width() / 2)));

            // rezize the current part of the volume bar
            volumeCurrent.width(Math.round(newLeft));
          }
        },
        handleVolumeMove = function (e) {

          var volume = null,
            totalOffset = volumeTotal.offset();

          // calculate the new volume based on the moust position
          if (mode === 'vertical') {

            var
              railHeight = volumeTotal.height(),
              totalTop = parseInt(volumeTotal.css('top').replace(/px/, ''), 10),
              newY = e.pageY - totalOffset.top;

            volume = (railHeight - newY) / railHeight;

            // the controls just hide themselves (usually when mouse moves too far up)
            if (totalOffset.top === 0 || totalOffset.left === 0) {
              return;
            }

          } else {
            var
              railWidth = volumeTotal.width(),
              newX = e.pageX - totalOffset.left;

            volume = newX / railWidth;
          }

          // ensure the volume isn't outside 0-1
          volume = Math.max(0, volume);
          volume = Math.min(volume, 1);

          // position the slider and handle
          positionVolumeHandle(volume);

          // set the media object (this will trigger the volumechanged event)
          if (volume === 0) {
            media.setMuted(true);
          } else {
            media.setMuted(false);
          }
          media.setVolume(volume);
        },
        mouseIsDown = false,
        mouseIsOver = false;

      // SLIDER

      mute
        .hover(function () {
          volumeSlider.show();
          mouseIsOver = true;
        }, function () {
          mouseIsOver = false;

          if (!mouseIsDown && mode == 'vertical') {
            volumeSlider.hide();
          }
        });

      var updateVolumeSlider = function (e) {

        var volume = Math.floor(media.volume * 100);

        volumeSlider.attr({
          'aria-label': 'volumeSlider',
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': volume,
          'aria-valuetext': volume + '%',
          'role': 'slider',
          'tabindex': 0
        });

      };

      volumeSlider
        .bind('mouseover', function () {
          mouseIsOver = true;
        })
        .bind('mousedown', function (e) {
          handleVolumeMove(e);
          t.globalBind('mousemove.vol', function (e) {
            handleVolumeMove(e);
          });
          t.globalBind('mouseup.vol', function () {
            mouseIsDown = false;
            t.globalUnbind('.vol');

            if (!mouseIsOver && mode == 'vertical') {
              volumeSlider.hide();
            }
          });
          mouseIsDown = true;

          return false;
        })
        .bind('keydown', function (e) {
          var keyCode = e.keyCode;
          var volume = media.volume;
          switch (keyCode) {
            case 38: // Up
              volume += 0.1;
              break;
            case 40: // Down
              volume = volume - 0.1;
              break;
            default:
              return true;
          }

          mouseIsDown = false;
          positionVolumeHandle(volume);
          media.setVolume(volume);
          return false;
        })
        .bind('blur', function () {
          volumeSlider.hide();
        });

      // MUTE button
      mute.find('button').click(function () {
        media.setMuted(!media.muted);
      });

      //Keyboard input
      mute.find('button').bind('focus', function () {
        volumeSlider.show();
      });

      // listen for volume change events from other sources
      media.addEventListener('volumechange', function (e) {
        if (!mouseIsDown) {
          if (media.muted) {
            positionVolumeHandle(0);
            mute.removeClass('mejs-mute').addClass('mejs-unmute');
          } else {
            positionVolumeHandle(media.volume);
            mute.removeClass('mejs-unmute').addClass('mejs-mute');
          }
        }
        updateVolumeSlider(e);
      }, false);

      if (t.container.is(':visible')) {
        // set initial volume
        positionVolumeHandle(player.options.startVolume);

        // mutes the media and sets the volume icon muted if the initial volume is set to 0
        if (player.options.startVolume === 0) {
          media.setMuted(true);
        }

        // shim gets the startvolume as a parameter, but we have to set it on the native <video> and <audio> elements
        if (media.pluginType === 'native') {
          media.setVolume(player.options.startVolume);
        }
      }
    }
  });

})(mejs.$);
(function ($) {

  $.extend(mejs.MepDefaults, {
    usePluginFullScreen: true,
    newWindowCallback: function () {
      return '';
    },
    fullscreenText: 'Fullscreen'
  });

  $.extend(MediaElementPlayer.prototype, {
    isFullScreen: false,
    isNativeFullScreen: false,
    isInIframe: false,
    buildfullscreen: function (player, controls, layers, media) {

      if (!player.isVideo)
        return;

      player.isInIframe = (window.location != window.parent.location);

      // native events
      if (mejs.MediaFeatures.hasTrueNativeFullScreen) {

        // chrome doesn't alays fire this in an iframe
        var func = function (e) {
          if (player.isFullScreen) {
            if (mejs.MediaFeatures.isFullScreen()) {
              player.isNativeFullScreen = true;
              // reset the controls once we are fully in full screen
              player.setControlsSize();
            } else {
              player.isNativeFullScreen = false;
              // when a user presses ESC
              // make sure to put the player back into place
              player.exitFullScreen();
            }
          }
        };

        player.globalBind(mejs.MediaFeatures.fullScreenEventName, func);
      }

      var t = this,
        normalHeight = 0,
        normalWidth = 0,
        container = player.container,
        fullscreenBtn =
        $('<div class="mejs-button mejs-fullscreen-button">' +
          '<button type="button" aria-controls="' + t.id + '" title="' + t.options.fullscreenText + '" aria-label="' + t.options.fullscreenText + '"></button>' +
          '</div>')
        .appendTo(controls);

      if (t.media.pluginType === 'native' || (!t.options.usePluginFullScreen && !mejs.MediaFeatures.isFirefox)) {

        fullscreenBtn.click(function () {
          var isFullScreen = (mejs.MediaFeatures.hasTrueNativeFullScreen && mejs.MediaFeatures.isFullScreen()) || player.isFullScreen;

          if (isFullScreen) {
            player.exitFullScreen();
          } else {
            player.enterFullScreen();
          }
        });

      } else {

        var hideTimeout = null,
          supportsPointerEvents = (function () {
            // TAKEN FROM MODERNIZR
            var element = document.createElement('x'),
              documentElement = document.documentElement,
              getComputedStyle = window.getComputedStyle,
              supports;
            if (!('pointerEvents' in element.style)) {
              return false;
            }
            element.style.pointerEvents = 'auto';
            element.style.pointerEvents = 'x';
            documentElement.appendChild(element);
            supports = getComputedStyle &&
              getComputedStyle(element, '').pointerEvents === 'auto';
            documentElement.removeChild(element);
            return !!supports;
          })();

        //console.log('supportsPointerEvents', supportsPointerEvents);

        if (supportsPointerEvents && !mejs.MediaFeatures.isOpera) { // opera doesn't allow this :(

          // allows clicking through the fullscreen button and controls down directly to Flash

          /*
           When a user puts his mouse over the fullscreen button, the controls are disabled
           So we put a div over the video and another one on iether side of the fullscreen button
           that caputre mouse movement
           and restore the controls once the mouse moves outside of the fullscreen button
           */

          var fullscreenIsDisabled = false,
            restoreControls = function () {
              if (fullscreenIsDisabled) {
                // hide the hovers
                for (var i in hoverDivs) {
                  hoverDivs[i].hide();
                }

                // restore the control bar
                fullscreenBtn.css('pointer-events', '');
                t.controls.css('pointer-events', '');

                // prevent clicks from pausing video
                t.media.removeEventListener('click', t.clickToPlayPauseCallback);

                // store for later
                fullscreenIsDisabled = false;
              }
            },
            hoverDivs = {},
            hoverDivNames = ['top', 'left', 'right', 'bottom'],
            i, len,
            positionHoverDivs = function () {
              var fullScreenBtnOffsetLeft = fullscreenBtn.offset().left - t.container.offset().left,
                fullScreenBtnOffsetTop = fullscreenBtn.offset().top - t.container.offset().top,
                fullScreenBtnWidth = fullscreenBtn.outerWidth(true),
                fullScreenBtnHeight = fullscreenBtn.outerHeight(true),
                containerWidth = t.container.width(),
                containerHeight = t.container.height();

              for (i in hoverDivs) {
                hoverDivs[i].css({position: 'absolute', top: 0, left: 0}); //, backgroundColor: '#f00'});
              }

              // over video, but not controls
              hoverDivs['top']
                .width(containerWidth)
                .height(fullScreenBtnOffsetTop);

              // over controls, but not the fullscreen button
              hoverDivs['left']
                .width(fullScreenBtnOffsetLeft)
                .height(fullScreenBtnHeight)
                .css({top: fullScreenBtnOffsetTop});

              // after the fullscreen button
              hoverDivs['right']
                .width(containerWidth - fullScreenBtnOffsetLeft - fullScreenBtnWidth)
                .height(fullScreenBtnHeight)
                .css({top: fullScreenBtnOffsetTop,
                  left: fullScreenBtnOffsetLeft + fullScreenBtnWidth});

              // under the fullscreen button
              hoverDivs['bottom']
                .width(containerWidth)
                .height(containerHeight - fullScreenBtnHeight - fullScreenBtnOffsetTop)
                .css({top: fullScreenBtnOffsetTop + fullScreenBtnHeight});
            };

          t.globalBind('resize', function () {
            positionHoverDivs();
          });

          for (i = 0, len = hoverDivNames.length; i < len; i++) {
            hoverDivs[hoverDivNames[i]] = $('<div class="mejs-fullscreen-hover" />').appendTo(t.container).mouseover(restoreControls).hide();
          }

          // on hover, kill the fullscreen button's HTML handling, allowing clicks down to Flash
          fullscreenBtn.on('mouseover', function () {

            if (!t.isFullScreen) {

              var buttonPos = fullscreenBtn.offset(),
                containerPos = player.container.offset();

              // move the button in Flash into place
              media.positionFullscreenButton(buttonPos.left - containerPos.left, buttonPos.top - containerPos.top, false);

              // allows click through
              fullscreenBtn.css('pointer-events', 'none');
              t.controls.css('pointer-events', 'none');

              // restore click-to-play
              t.media.addEventListener('click', t.clickToPlayPauseCallback);

              // show the divs that will restore things
              for (i in hoverDivs) {
                hoverDivs[i].show();
              }

              positionHoverDivs();

              fullscreenIsDisabled = true;
            }

          });

          // restore controls anytime the user enters or leaves fullscreen
          media.addEventListener('fullscreenchange', function (e) {
            t.isFullScreen = !t.isFullScreen;
            // don't allow plugin click to pause video - messes with
            // plugin's controls
            if (t.isFullScreen) {
              t.media.removeEventListener('click', t.clickToPlayPauseCallback);
            } else {
              t.media.addEventListener('click', t.clickToPlayPauseCallback);
            }
            restoreControls();
          });


          // the mouseout event doesn't work on the fullscren button, because we already killed the pointer-events
          // so we use the document.mousemove event to restore controls when the mouse moves outside the fullscreen button

          t.globalBind('mousemove', function (e) {

            // if the mouse is anywhere but the fullsceen button, then restore it all
            if (fullscreenIsDisabled) {

              var fullscreenBtnPos = fullscreenBtn.offset();


              if (e.pageY < fullscreenBtnPos.top || e.pageY > fullscreenBtnPos.top + fullscreenBtn.outerHeight(true) ||
                e.pageX < fullscreenBtnPos.left || e.pageX > fullscreenBtnPos.left + fullscreenBtn.outerWidth(true)
                ) {

                fullscreenBtn.css('pointer-events', '');
                t.controls.css('pointer-events', '');

                fullscreenIsDisabled = false;
              }
            }
          });



        } else {

          // the hover state will show the fullscreen button in Flash to hover up and click

          fullscreenBtn
            .on('mouseover', function () {

              if (hideTimeout !== null) {
                clearTimeout(hideTimeout);
                delete hideTimeout;
              }

              var buttonPos = fullscreenBtn.offset(),
                containerPos = player.container.offset();

              media.positionFullscreenButton(buttonPos.left - containerPos.left, buttonPos.top - containerPos.top, true);

            })
            .on('mouseout', function () {

              if (hideTimeout !== null) {
                clearTimeout(hideTimeout);
                delete hideTimeout;
              }

              hideTimeout = setTimeout(function () {
                media.hideFullscreenButton();
              }, 1500);


            });
        }
      }

      player.fullscreenBtn = fullscreenBtn;

      t.globalBind('keydown', function (e) {
        if (((mejs.MediaFeatures.hasTrueNativeFullScreen && mejs.MediaFeatures.isFullScreen()) || t.isFullScreen) && e.keyCode == 27) {
          player.exitFullScreen();
        }
      });

    },
    cleanfullscreen: function (player) {
      player.exitFullScreen();
    },
    containerSizeTimeout: null,
    enterFullScreen: function () {

      var t = this;

      // firefox+flash can't adjust plugin sizes without resetting :(
      if (t.media.pluginType !== 'native' && (mejs.MediaFeatures.isFirefox || t.options.usePluginFullScreen)) {
        //t.media.setFullscreen(true);
        //player.isFullScreen = true;
        return;
      }

      // set it to not show scroll bars so 100% will work
      $(document.documentElement).addClass('mejs-fullscreen');

      // store sizing
      normalHeight = t.container.height();
      normalWidth = t.container.width();

      // attempt to do true fullscreen (Safari 5.1 and Firefox Nightly only for now)
      if (t.media.pluginType === 'native') {
        if (mejs.MediaFeatures.hasTrueNativeFullScreen) {

          mejs.MediaFeatures.requestFullScreen(t.container[0]);
          //return;

          if (t.isInIframe) {
            // sometimes exiting from fullscreen doesn't work
            // notably in Chrome <iframe>. Fixed in version 17
            setTimeout(function checkFullscreen() {

              if (t.isNativeFullScreen) {
                var zoomMultiplier = window["devicePixelRatio"] || 1;
                // Use a percent error margin since devicePixelRatio is a float and not exact.
                var percentErrorMargin = 0.002; // 0.2%
                var windowWidth = zoomMultiplier * $(window).width();
                var screenWidth = screen.width;
                var absDiff = Math.abs(screenWidth - windowWidth);
                var marginError = screenWidth * percentErrorMargin;

                // check if the video is suddenly not really fullscreen
                if (absDiff > marginError) {
                  // manually exit
                  t.exitFullScreen();
                } else {
                  // test again
                  setTimeout(checkFullscreen, 500);
                }
              }


            }, 500);
          }

        } else if (mejs.MediaFeatures.hasSemiNativeFullScreen) {
          t.media.webkitEnterFullscreen();
          return;
        }
      }

      // check for iframe launch
      if (t.isInIframe) {
        var url = t.options.newWindowCallback(this);


        if (url !== '') {

          // launch immediately
          if (!mejs.MediaFeatures.hasTrueNativeFullScreen) {
            t.pause();
            window.open(url, t.id, 'top=0,left=0,width=' + screen.availWidth + ',height=' + screen.availHeight + ',resizable=yes,scrollbars=no,status=no,toolbar=no');
            return;
          } else {
            setTimeout(function () {
              if (!t.isNativeFullScreen) {
                t.pause();
                window.open(url, t.id, 'top=0,left=0,width=' + screen.availWidth + ',height=' + screen.availHeight + ',resizable=yes,scrollbars=no,status=no,toolbar=no');
              }
            }, 250);
          }
        }

      }

      // full window code



      // make full size
      t.container
        .addClass('mejs-container-fullscreen')
        .width('100%')
        .height('100%');
      //.css({position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden', width: '100%', height: '100%', 'z-index': 1000});

      // Only needed for safari 5.1 native full screen, can cause display issues elsewhere
      // Actually, it seems to be needed for IE8, too
      //if (mejs.MediaFeatures.hasTrueNativeFullScreen) {
      t.containerSizeTimeout = setTimeout(function () {
        t.container.css({width: '100%', height: '100%'});
        t.setControlsSize();
      }, 500);
      //}

      if (t.media.pluginType === 'native') {
        t.$media
          .width('100%')
          .height('100%');
      } else {
        t.container.find('.mejs-shim')
          .width('100%')
          .height('100%');

        //if (!mejs.MediaFeatures.hasTrueNativeFullScreen) {
        t.media.setVideoSize($(window).width(), $(window).height());
        //}
      }

      t.layers.children('div')
        .width('100%')
        .height('100%');

      if (t.fullscreenBtn) {
        t.fullscreenBtn
          .removeClass('mejs-fullscreen')
          .addClass('mejs-unfullscreen');
      }

      t.setControlsSize();
      t.isFullScreen = true;

      t.container.find('.mejs-captions-text').css('font-size', screen.width / t.width * 1.00 * 100 + '%');
      t.container.find('.mejs-captions-position').css('bottom', '45px');
    },
    exitFullScreen: function () {

      var t = this;

      // Prevent container from attempting to stretch a second time
      clearTimeout(t.containerSizeTimeout);

      // firefox can't adjust plugins
      if (t.media.pluginType !== 'native' && mejs.MediaFeatures.isFirefox) {
        t.media.setFullscreen(false);
        //player.isFullScreen = false;
        return;
      }

      // come outo of native fullscreen
      if (mejs.MediaFeatures.hasTrueNativeFullScreen && (mejs.MediaFeatures.isFullScreen() || t.isFullScreen)) {
        mejs.MediaFeatures.cancelFullScreen();
      }

      // restore scroll bars to document
      $(document.documentElement).removeClass('mejs-fullscreen');

      t.container
        .removeClass('mejs-container-fullscreen')
        .width(normalWidth)
        .height(normalHeight);
      //.css({position: '', left: '', top: '', right: '', bottom: '', overflow: 'inherit', width: normalWidth + 'px', height: normalHeight + 'px', 'z-index': 1});

      if (t.media.pluginType === 'native') {
        t.$media
          .width(normalWidth)
          .height(normalHeight);
      } else {
        t.container.find('.mejs-shim')
          .width(normalWidth)
          .height(normalHeight);

        t.media.setVideoSize(normalWidth, normalHeight);
      }

      t.layers.children('div')
        .width(normalWidth)
        .height(normalHeight);

      t.fullscreenBtn
        .removeClass('mejs-unfullscreen')
        .addClass('mejs-fullscreen');

      t.setControlsSize();
      t.isFullScreen = false;

      t.container.find('.mejs-captions-text').css('font-size', '');
      t.container.find('.mejs-captions-position').css('bottom', '');
    }
  });

})(mejs.$);

/*
 * ContextMenu Plugin
 *
 *
 */

(function ($) {

  $.extend(mejs.MepDefaults,
    {'contextMenuItems': [
        // demo of a fullscreen option
        {
          render: function (player) {

            // check for fullscreen plugin
            if (typeof player.enterFullScreen == 'undefined')
              return null;

            if (player.isFullScreen) {
              return 'Turn off Fullscreen';
            } else {
              return 'Go Fullscreen';
            }
          },
          click: function (player) {
            if (player.isFullScreen) {
              player.exitFullScreen();
            } else {
              player.enterFullScreen();
            }
          }
        }
        ,
        // demo of a mute/unmute button
        {
          render: function (player) {
            if (player.media.muted) {
              return 'Unmute';
            } else {
              return 'Mute';
            }
          },
          click: function (player) {
            if (player.media.muted) {
              player.setMuted(false);
            } else {
              player.setMuted(true);
            }
          }
        },
        // separator
        {
          isSeparator: true
        }
        ,
        // demo of simple download video
        {
          render: function (player) {
            return 'Download Video';
          },
          click: function (player) {
            window.location.href = player.media.currentSrc;
          }
        }
      ]}
  );


  $.extend(MediaElementPlayer.prototype, {
    buildcontextmenu: function (player, controls, layers, media) {

      // create context menu
      player.contextMenu = $('<div class="mejs-contextmenu"></div>')
        .appendTo($('body'))
        .hide();

      // create events for showing context menu
      player.container.bind('contextmenu', function (e) {
        if (player.isContextMenuEnabled) {
          e.preventDefault();
          player.renderContextMenu(e.clientX - 1, e.clientY - 1);
          return false;
        }
      });
      player.container.bind('click', function () {
        player.contextMenu.hide();
      });
      player.contextMenu.bind('mouseleave', function () {

        //console.log('context hover out');
        player.startContextMenuTimer();

      });
    },
    cleancontextmenu: function (player) {
      player.contextMenu.remove();
    },
    isContextMenuEnabled: true,
    enableContextMenu: function () {
      this.isContextMenuEnabled = true;
    },
    disableContextMenu: function () {
      this.isContextMenuEnabled = false;
    },
    contextMenuTimeout: null,
    startContextMenuTimer: function () {
      //console.log('startContextMenuTimer');

      var t = this;

      t.killContextMenuTimer();

      t.contextMenuTimer = setTimeout(function () {
        t.hideContextMenu();
        t.killContextMenuTimer();
      }, 750);
    },
    killContextMenuTimer: function () {
      var timer = this.contextMenuTimer;

      //console.log('killContextMenuTimer', timer);

      if (timer != null) {
        clearTimeout(timer);
        delete timer;
        timer = null;
      }
    },
    hideContextMenu: function () {
      this.contextMenu.hide();
    },
    renderContextMenu: function (x, y) {

      // alway re-render the items so that things like "turn fullscreen on" and "turn fullscreen off" are always written correctly
      var t = this,
        html = '',
        items = t.options.contextMenuItems;

      for (var i = 0, il = items.length; i < il; i++) {

        if (items[i].isSeparator) {
          html += '<div class="mejs-contextmenu-separator"></div>';
        } else {

          var rendered = items[i].render(t);

          // render can return null if the item doesn't need to be used at the moment
          if (rendered != null) {
            html += '<div class="mejs-contextmenu-item" data-itemindex="' + i + '" id="element-' + (Math.random() * 1000000) + '">' + rendered + '</div>';
          }
        }
      }

      // position and show the context menu
      t.contextMenu
        .empty()
        .append($(html))
        .css({top: y, left: x})
        .show();

      // bind events
      t.contextMenu.find('.mejs-contextmenu-item').each(function () {

        // which one is this?
        var $dom = $(this),
          itemIndex = parseInt($dom.data('itemindex'), 10),
          item = t.options.contextMenuItems[itemIndex];

        // bind extra functionality?
        if (typeof item.show != 'undefined')
          item.show($dom, t);

        // bind click action
        $dom.click(function () {
          // perform click action
          if (typeof item.click != 'undefined')
            item.click(t);

          // close
          t.contextMenu.hide();
        });
      });

      // stop the controls from hiding
      setTimeout(function () {
        t.killControlsTimer('rev3');
      }, 100);

    }
  });

})(mejs.$);