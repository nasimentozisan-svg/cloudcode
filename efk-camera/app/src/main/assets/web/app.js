/*
 * EFK CAMERA 操作画面
 *
 * 設計上の要点（設計書 3.2）
 *  - 1秒ポーリング。切れても次の1秒で勝手に復帰する。
 *  - 経過時間はサーバの開始時刻からブラウザ側で毎秒カウントするので、
 *    ポーリング間隔でカクつかない。
 *  - 認証トークンは HttpOnly Cookie。JS からは触らない。
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var state = null;
  var lastGoodAt = 0;
  var recBaseElapsed = 0;
  var recBaseAt = 0;
  var previewOn = false;
  var settingsOpen = false;
  var stopHoldTimer = null;
  var busy = false;

  // ---------------------------------------------------------------- utils

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function hhmmss(ms) {
    if (!ms || ms < 0) ms = 0;
    var t = Math.floor(ms / 1000);
    return pad(Math.floor(t / 3600)) + ':' + pad(Math.floor((t % 3600) / 60)) + ':' + pad(t % 60);
  }

  function post(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      credentials: 'same-origin'
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { throw new Error(data.error || ('エラー (HTTP ' + res.status + ')')); }
        return data;
      });
    });
  }

  // ------------------------------------------------------------- pairing

  function showPairing() {
    $('pairView').classList.remove('hidden');
    $('mainView').classList.add('hidden');
    fetch('/api/info', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (info) {
        $('pairDevice').textContent = info.deviceName + ' に接続します';
      })
      .catch(function () {
        $('pairDevice').textContent = 'カメラに接続できません';
      });
  }

  function showMain() {
    $('pairView').classList.add('hidden');
    $('mainView').classList.remove('hidden');
  }

  $('pairButton').addEventListener('click', function () {
    var pin = $('pinInput').value.trim();
    $('pairError').textContent = '';
    post('/api/pair', { pin: pin })
      .then(function () {
        $('pinInput').value = '';
        showMain();
        poll();
      })
      .catch(function (e) { $('pairError').textContent = e.message; });
  });

  $('pinInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { $('pairButton').click(); }
  });

  // ---------------------------------------------------------------- poll

  function poll() {
    fetch('/api/status', { credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 401) { showPairing(); return null; }
        if (!res.ok) { throw new Error('status ' + res.status); }
        return res.json();
      })
      .then(function (data) {
        if (!data) { return; }
        showMain();
        lastGoodAt = Date.now();
        apply(data);
      })
      .catch(function () { markOffline(); });
  }

  function markOffline() {
    var el = $('link');
    if (Date.now() - lastGoodAt > 4000) {
      el.textContent = '● 未接続（録画は継続しています）';
      el.className = 'dot dot-ng';
    }
  }

  // --------------------------------------------------------------- render

  function apply(s) {
    var first = state === null;
    state = s;

    $('link').textContent = '● 接続中';
    $('link').className = 'dot dot-ok';
    $('deviceName').textContent = s.device.name;
    $('battery').textContent =
      (s.battery.percent >= 0 ? s.battery.percent + '%' : '--') + (s.battery.charging ? ' ⚡' : '');
    $('free').textContent = s.storage.freeText + '（約' + s.storage.recordableMinutes + '分）';
    $('temp').textContent = s.battery.temperatureC.toFixed(1) + '℃';
    $('tempStat').style.color = s.battery.temperatureC >= 45 ? 'var(--err)'
      : (s.battery.temperatureC >= 40 ? 'var(--warn)' : '');

    $('footer').textContent =
      s.device.model + ' / Android SDK ' + s.device.androidSdk +
      ' / v' + s.device.version + ' (' + s.device.build + ')';

    renderWarnings(s.warnings);
    renderRecording(s);
    renderUploads(s.uploads);
    renderTitlePreview();
    if (first || !settingsOpen) { fillSettings(s.settings); }
    updatePreviewAvailability(s);
  }

  function renderWarnings(list) {
    var box = $('warnings');
    box.innerHTML = '';
    (list || []).forEach(function (w) {
      var div = document.createElement('div');
      div.className = 'warn-box warn-' + w.level;
      div.textContent = w.message;
      box.appendChild(div);
    });
  }

  function renderRecording(s) {
    var rec = s.recording;
    var recording = rec.state === 'RECORDING' || rec.state === 'STOPPING';
    var btn = $('recButton');

    recBaseElapsed = rec.elapsedMs;
    recBaseAt = Date.now();

    $('recBadge').classList.toggle('hidden', !recording);
    $('matchName').disabled = recording;

    if (recording) {
      btn.textContent = rec.state === 'STOPPING' ? '停止しています…' : '■ 録画停止（長押し）';
      btn.className = 'btn btn-record stop';
      $('stopHint').textContent = '誤操作防止のため、停止は1.5秒の長押しです';
    } else if (rec.state === 'STARTING') {
      btn.textContent = '開始しています…';
      btn.className = 'btn btn-record';
      $('stopHint').textContent = '';
    } else {
      btn.textContent = '🔴 録画開始';
      btn.className = 'btn btn-record';
      $('stopHint').textContent = '';
    }
    btn.disabled = !s.camera.ready || busy || rec.state === 'STARTING' || rec.state === 'STOPPING';

    if (rec.error) { $('actionError').textContent = rec.error; }
    // 録画中は、サーバが保持している試合名を正として表示する（再接続時の復元）
    if (recording && rec.matchName) { $('matchName').value = rec.matchName; }
    tickTimer();
  }

  function tickTimer() {
    if (!state) { return; }
    var rec = state.recording;
    var recording = rec.state === 'RECORDING' || rec.state === 'STOPPING';
    var ms = recording ? recBaseElapsed + (Date.now() - recBaseAt) : 0;
    $('timer').textContent = hhmmss(ms);
  }

  function renderTitlePreview() {
    var name = $('matchName').value.trim();
    var d = new Date();
    var stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    $('titlePreview').textContent =
      'YouTube タイトル: ' + stamp + ' ' + (name || '試合');
  }

  function renderUploads(list) {
    var box = $('uploads');
    box.innerHTML = '';
    if (!list || list.length === 0) {
      var p = document.createElement('p');
      p.className = 'muted small';
      p.textContent = '録画はまだありません';
      box.appendChild(p);
      return;
    }
    list.forEach(function (u) {
      var item = document.createElement('div');
      item.className = 'up-item';

      var title = document.createElement('div');
      title.className = 'up-title';
      title.textContent = u.title;
      item.appendChild(title);

      var meta = document.createElement('div');
      meta.className = 'up-meta';
      meta.textContent = u.stateText + ' ・ ' + u.sizeText + ' ・ ' + u.durationText +
        ' ・ ' + u.recordedAt;
      item.appendChild(meta);

      if (u.state === 'UPLOADING') {
        var bar = document.createElement('div');
        bar.className = 'bar';
        var fill = document.createElement('i');
        fill.style.width = u.progressPercent + '%';
        bar.appendChild(fill);
        item.appendChild(bar);
        var pct = document.createElement('div');
        pct.className = 'up-meta';
        pct.textContent = 'アップロード中 ' + u.progressPercent + '%';
        item.appendChild(pct);
      }

      if (u.url) {
        var link = document.createElement('div');
        link.className = 'up-meta';
        var a = document.createElement('a');
        a.href = u.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'YouTube で確認';
        link.appendChild(a);
        item.appendChild(link);
      }

      if (u.privacyStatus && u.privacyStatus !== 'unlisted') {
        var note = document.createElement('div');
        note.className = 'up-note';
        note.textContent = u.privacyStatus === 'private'
          ? '現在 API 制限により非公開でアップロードされています'
          : '公開設定: ' + u.privacyStatus;
        item.appendChild(note);
      }

      if (u.error) {
        var err = document.createElement('div');
        err.className = 'up-err';
        err.textContent = u.error;
        item.appendChild(err);
      }

      if (u.holdsFile) {
        var actions = document.createElement('div');
        actions.className = 'up-actions';

        if (u.state !== 'DONE') {
          var retry = document.createElement('button');
          retry.className = 'btn';
          retry.textContent = '再アップロード';
          retry.addEventListener('click', function () { retryUpload(u.id); });
          actions.appendChild(retry);
        }

        var del = document.createElement('button');
        del.className = 'btn';
        del.textContent = '端末から削除';
        del.addEventListener('click', function () { deleteRecord(u); });
        actions.appendChild(del);

        item.appendChild(actions);
      }

      box.appendChild(item);
    });
  }

  function retryUpload(id) {
    post('/api/uploads/retry', { id: id })
      .then(poll)
      .catch(function (e) { alert(e.message); });
  }

  function deleteRecord(u) {
    var msg = u.needsWarningOnDelete
      ? 'この動画はまだ YouTube にアップロードされていません。\n' +
        '削除すると二度と戻せません。本当に削除しますか？'
      : 'この動画を端末から削除しますか？';
    if (!window.confirm(msg)) { return; }
    if (u.needsWarningOnDelete) {
      var typed = window.prompt('本当に削除する場合は DELETE と入力してください');
      if (typed !== 'DELETE') { return; }
      post('/api/uploads/delete', { id: u.id, confirm: 'DELETE' })
        .then(poll).catch(function (e) { alert(e.message); });
    } else {
      post('/api/uploads/delete', { id: u.id })
        .then(poll).catch(function (e) { alert(e.message); });
    }
  }

  // ------------------------------------------------------------- record

  var recBtn = $('recButton');

  recBtn.addEventListener('click', function () {
    if (!state) { return; }
    var rec = state.recording;
    if (rec.state === 'RECORDING' || rec.state === 'STOPPING') { return; } // 長押しのみ
    startRecording();
  });

  function holdStart() {
    if (!state) { return; }
    var rec = state.recording;
    if (rec.state !== 'RECORDING') { return; }
    stopHoldTimer = window.setTimeout(function () {
      stopHoldTimer = null;
      stopRecording();
    }, 1500);
  }

  function holdEnd() {
    if (stopHoldTimer) { window.clearTimeout(stopHoldTimer); stopHoldTimer = null; }
  }

  recBtn.addEventListener('touchstart', holdStart, { passive: true });
  recBtn.addEventListener('touchend', holdEnd);
  recBtn.addEventListener('touchcancel', holdEnd);
  recBtn.addEventListener('mousedown', holdStart);
  recBtn.addEventListener('mouseup', holdEnd);
  recBtn.addEventListener('mouseleave', holdEnd);

  function startRecording() {
    busy = true;
    $('actionError').textContent = '';
    post('/api/record/start', { matchName: $('matchName').value.trim() })
      .catch(function (e) { $('actionError').textContent = e.message; })
      .then(function () { busy = false; poll(); });
  }

  function stopRecording() {
    busy = true;
    $('actionError').textContent = '';
    post('/api/record/stop', {})
      .catch(function (e) { $('actionError').textContent = e.message; })
      .then(function () { busy = false; poll(); });
  }

  $('matchName').addEventListener('input', renderTitlePreview);

  // ------------------------------------------------------------ preview

  function updatePreviewAvailability(s) {
    var msg = $('previewMsg');
    var toggle = $('previewToggle');
    if (!s.camera.previewAvailable) {
      stopPreview();
      toggle.disabled = true;
      msg.textContent = 'この端末ではプレビューを利用できません（録画には影響しません）';
      return;
    }
    toggle.disabled = false;
    if (!previewOn) { msg.textContent = 'プレビューは停止しています'; }
  }

  function startPreview() {
    previewOn = true;
    var img = $('preview');
    img.src = '/api/preview.mjpg?ts=' + Date.now();
    img.classList.add('on');
    $('previewMsg').textContent = '';
    $('previewToggle').textContent = '停止';
  }

  function stopPreview() {
    previewOn = false;
    var img = $('preview');
    img.classList.remove('on');
    img.removeAttribute('src');
    $('previewToggle').textContent = '表示';
    $('previewMsg').textContent = 'プレビューは停止しています';
  }

  $('previewToggle').addEventListener('click', function () {
    if (previewOn) { stopPreview(); } else { startPreview(); }
  });

  // MJPEG は一定枚数で切れるので、表示中なら張り直す
  $('preview').addEventListener('error', function () {
    if (previewOn) { window.setTimeout(startPreview, 800); }
  });
  $('preview').addEventListener('load', function () {
    if (previewOn) { $('previewMsg').textContent = ''; }
  });

  // ----------------------------------------------------------- settings

  $('settingsToggle').addEventListener('click', function () {
    settingsOpen = !settingsOpen;
    $('settings').classList.toggle('hidden', !settingsOpen);
    if (settingsOpen && state) { fillSettings(state.settings); }
  });

  function fillSettings(cfg) {
    if (!cfg) { return; }
    $('setQuality').value = cfg.quality;
    $('setOrientation').value = cfg.orientation;
    $('setSplit').value = String(cfg.splitMinutes);
    $('setAudio').checked = !!cfg.audioEnabled;
    $('setPreview').checked = !!cfg.previewEnabled;
    $('setWifiOnly').checked = !!cfg.wifiOnlyUpload;
  }

  $('saveSettings').addEventListener('click', function () {
    $('settingsError').textContent = '';
    post('/api/settings', {
      quality: $('setQuality').value,
      orientation: $('setOrientation').value,
      splitMinutes: parseInt($('setSplit').value, 10),
      audioEnabled: $('setAudio').checked,
      previewEnabled: $('setPreview').checked,
      wifiOnlyUpload: $('setWifiOnly').checked
    })
      .then(function () { settingsOpen = false; $('settings').classList.add('hidden'); poll(); })
      .catch(function (e) { $('settingsError').textContent = e.message; });
  });

  // --------------------------------------------------------------- boot

  // 画面を消さない（対応ブラウザのみ）
  if ('wakeLock' in navigator) {
    var lock = null;
    var acquire = function () {
      navigator.wakeLock.request('screen')
        .then(function (l) { lock = l; })
        .catch(function () { /* 失敗しても操作には支障なし */ });
    };
    acquire();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && lock === null) { acquire(); }
    });
  }

  window.setInterval(poll, 1000);
  window.setInterval(tickTimer, 250);
  window.setInterval(markOffline, 1000);
  poll();
  renderTitlePreview();
})();
