//@ts-check

async function massBlock() {
  const dummy = {};

  const progressPopup = await showProgressPopup();
  const thumbsUp = '\uD83D\uDC4D';

  async function showProgressPopup() {
    const animationTimeMsec = 200;

    const normalTitleBg = 'linear-gradient(to right, #eee, #ddd 20%, #ddd 80%, #eee)';
    const alertTitleBg = 'linear-gradient(to right, #ffb3a5, #fd927f 20%, #fd927f 80%, #ffa898)';

    // past popups
    // @ts-ignore
    if (window.progressPopup && window.progressPopup.parentElement) window.progressPopup.parentElement.removeChild(window.progressPopup);

    /** @type {HTMLElement & {titleElem: typeof titleElem, contentElem: HTMLElement, closePopup(), allowClosePopup() }} */
    const progressPopup = /** @type {*}*/(document.createElement('div'));
    // @ts-ignore
    window.progressPopup = progressPopup;
    progressPopup.style.cssText = `
      position: fixed;top: 0.5em;right: 0.5em;min-width: 25em;min-height: 5em;
      background: white;border: 1px solid silver; box-shadow: #7f7f7f 2px 2px 6px;border-radius: 0.3em;
      z-index: 100000;font-family: sans-serif;font-size: 10pt;transition: transform ${animationTimeMsec}ms; transform: translateY(-200%);
      overflow: auto;`;
    document.body.appendChild(progressPopup);
    progressPopup.style.transform = '';

    /** @type {HTMLElement & {setNormal(), setAlert()}} */
    const titleElem = /** @type {*} */(progressPopup.appendChild(document.createElement('div')));
    titleElem.textContent = ' ';
    titleElem.style.cssText = `
      width: 100%;
      top: 0; left: 0;
      padding: 0.2em;
      box-sizing: border-box;
      background: linear-gradient(to right, #eee, #ddd 20%, #ddd 80%, #eee);
      border-bottom: solid 1px #ddd;`;
    titleElem.setNormal = setNormal;
    titleElem.setAlert = setAlert;

    const contentElem = progressPopup.appendChild(document.createElement('div'));
    contentElem.style.cssText = `
      padding: 0.25em;`;
    
    progressPopup.titleElem = titleElem;
    progressPopup.contentElem = contentElem;
    progressPopup.closePopup = closePopup;
    progressPopup.allowClosePopup = allowClosePopup;

    return progressPopup;

    function setNormal() {
      progressPopup.titleElem.style.background = normalTitleBg;
    }

    function setAlert() {
      progressPopup.titleElem.style.background = alertTitleBg;
    }

    var crossButton;

    function allowClosePopup() {
      if (crossButton) return;

      crossButton = progressPopup.appendChild(document.createElement('div'));
      crossButton.textContent = '\u292c';
      crossButton.style.cssText = `
        position: absolute; right: 0; top: 0; width: 1.5em; height: 1.5em;
        padding-top: 0.2em;
        cursor: pointer; text-align: center;`;
      crossButton.onclick = closePopup;
    }

    function closePopup() {
      if (progressPopup.parentElement) progressPopup.parentElement.removeChild(progressPopup);
    }
  }

  async function detectLikesButton() {
    const pairTweetContainerAndLikesButton = /** @type {[HTMLElement, HTMLButtonElement]} */([...document.querySelectorAll('article[role=article]')].map(art => [
      art,
      [...art.querySelectorAll('a[role=link]')].filter(a => /\sLikes$/i.test(a?.textContent || ''))[0]
    ]).filter(pair => pair[0] && pair[1])[0]);

    if (!pairTweetContainerAndLikesButton) return;
    const [tweetContainer, likesListButton] = pairTweetContainerAndLikesButton;

    // close any open dialogs first
    const progressContent = progressPopup.contentElem.textContent;
    const dialog = document.querySelector('div[role=dialog]') || document.querySelector('div[data-testid=confirmationSheetDialog]');
    let closeTake = 0;
    if (dialog) {
      const dialogClose = /**@type {HTMLButtonElement} */(dialog.querySelector('div[role=button][aria-label=Close]'));
      if (dialogClose) {
        progressPopup.contentElem.textContent = progressContent + ` (closing dialog${closeTake ? ' ' + closeTake : ''})...`;
        dialogClose.click();
        closeTake++;
        await waitFor(() => !document.querySelector('div[role=dialog]') || document.querySelector('div[data-testid=confirmationSheetDialog]'));
      }
    }

    return { tweetContainer, likesListButton };
  }

  async function collectAllLikes() {
    const dialog = await waitFor(() => document.querySelector('div[role=dialog]') || document.querySelector('div[data-testid=confirmationSheetDialog]'));
    const dialogClose = await waitFor(() => dialog.querySelector('div[role=button][aria-label=Close]'));
    await waitFor(() => /^Liked by/.test(dialog.querySelector('h2[role=heading]').textContent));
    console.log('Awaiting the likes... ', { tweetContainer, likesListButton, dialog, dialogClose });

    progressPopup.contentElem.textContent = `Before proceeding: collecting ${thumbsUp}likes...`;

    const timeline = await waitFor(() => [...dialog.querySelectorAll('div[aria-label]')].filter(label => /Timeline/.test(label.getAttribute('aria-label')))[0]);

    /** @type {string[]} */
    const allFans = [];
    const allFansMap = {};

    let reportLineElems = [];
    while (true) {
      const fans = [...(await waitFor(() => timeline.querySelectorAll('div[role=button][data-testid=UserCell]')))].reverse();
      let anyNewFans = false;
      for (const f of fans) {
        const fanUrl = f.querySelector('a[role=link]').href;
        if (allFansMap[fanUrl]) continue;

        anyNewFans = true;
        allFans.push(fanUrl);
        allFansMap[fanUrl] = fanUrl;
      }

      if (!anyNewFans) {
        break;
      }

      const reportLineElem = document.createElement('div');
      console.log(reportLineElem.textContent = ' ...' + allFans.length + ' ' + allFans[allFans.length - 1] + '...');
      reportLineElems.push(reportLineElem);
      if (reportLineElems.length > 4) {
        progressPopup.contentElem.removeChild(reportLineElems[0]);
        reportLineElems.shift();
      }
      progressPopup.contentElem.appendChild(reportLineElem);

      const scrollTo = fans[0];
      scrollTo.scrollIntoView({ behavior: 'smooth' });

      try {
        await waitFor(() => [...timeline.querySelectorAll('div[role=button][data-testid=UserCell]')].slice(-1)[0] !== fans[0], 5000);
      } catch (okNoMore) {
        break;
      }
    }

    const closeLikesButton = await waitFor(() => document.querySelector('[aria-label=Close][role=button]'));
    closeLikesButton.click();

    console.log(allFans.length + ' found', allFans);

    return allFans;
  }

  function promptProgressAsync(text, buttons) {
    return new Promise((resolve) => {
      if (typeof text === 'string') {
        progressPopup.contentElem.textContent = text;
      } else {
        progressPopup.contentElem.textContent = '';
        progressPopup.contentElem.appendChild(text);
      }

      const buttonBar = progressPopup.contentElem.appendChild(document.createElement('div'));
      if (buttons && buttons.length) {
        for (const btn of buttons) {
          addBtn(btn);
        }
      } else if (buttons) {
        addBtn(buttons);
      } else {
        addBtn('OK', true);
        addBtn('Cancel', false);
      }

      function addBtn(btn, status) {
        if (typeof btn === 'string') {
          const btnElem = document.createElement('button');
          btnElem.textContent = btn;
          btnElem.onclick = () => {
            resolve(arguments.length === 1 ? btn : arguments[1]);
          };
          buttonBar.appendChild(btnElem);
        } else {
          btn.addEventListener('click', () => {
            resolve(arguments.length === 1 ? btn.textContent : arguments[1]);
          });
          buttonBar.appendChild(btn);
        }
      };
    });
  }

  progressPopup.titleElem.textContent = `\uD83D\uDEAB Block all likes`;
  progressPopup.contentElem.textContent = 'Before proceeding...';

  const { tweetContainer, likesListButton } = await detectLikesButton() || {};
  if (!tweetContainer || !likesListButton) {
    progressPopup.contentElem.textContent = `Cannot proceed: no ${thumbsUp}likes button detected.`;
    progressPopup.titleElem.setAlert();
    return;
  }

  progressPopup.contentElem.textContent = `Before proceeding: get ${thumbsUp}likes...`;
  likesListButton.click();

  const allFans = await collectAllLikes();

  if (!allFans.length) {
    progressPopup.contentElem.textContent = `Cannot proceed: the tweet has ZERO ${thumbsUp}likes.`;
    progressPopup.titleElem.setAlert();
  }

  if (!await promptProgressAsync(`${allFans.length} ${thumbsUp}likes, proceed to block them?`)) {
    progressPopup.contentElem.textContent = `${allFans.length} ${thumbsUp}likes, decided not to proceed.`;
    progressPopup.allowClosePopup();
    return;
  }

  progressPopup.contentElem.textContent = '';

  const currentStatus = document.createElement('div');
  currentStatus.style.whiteSpace = 'nowrap';
  currentStatus.style.borderBottom = 'solid 1px gray';
  currentStatus.style.marginBottom = '0.5em';
  currentStatus.textContent = 'Blocking: ' + allFans.length + '...';
  progressPopup.contentElem.appendChild(currentStatus);

  const doneFans = [];
  const blockedList = /** @type {string[] & { last: string[] }} */(/** @type {string[]} */([]));
  const skippedList = /** @type {string[] & { last: string[] }} */(/** @type {string[]} */([]));
  blockedList.last = blockedList.slice();
  skippedList.last = skippedList.slice();
  window['blockedList'] = blockedList;
  window['skippedList'] = skippedList;

  /** @type {Window[]} */
  const anotherWindows = [];
  const anotherLogs = [];

  const startBlocking = Date.now();
  let lastReport = Date.now();
  const MAX_PARALLEL = 6;
  let nextFanIndex = 0;
  while (true) {
    const fans = allFans.slice(nextFanIndex, nextFanIndex + MAX_PARALLEL);
    nextFanIndex += fans.length;

    let noneFound = true;

    const waitParallel = [];
    let lastFanIndex;
    for (let i = 0; i < fans.length; i++) {
      const fanUrl = fans[i];
      lastFanIndex = i;

      let anotherWindow = anotherWindows[waitParallel.length];
      let anotherLog = anotherLogs[waitParallel.length];
      if (!anotherWindow) {
        anotherWindow = /** @type {Window} */(window.open(fanUrl, 'window-' + waitParallel.length));
        if (!anotherWindow) throw new Error('Popups blocked?');
        anotherWindows.push(anotherWindow);
        anotherLog = document.createElement('div');
        anotherLog.style.cssText = 'white-space: nowrap; font-size: 80%; font-family: sans-serif;';
        progressPopup.contentElem.appendChild(anotherLog);
        anotherLogs.push(anotherLog);
      }

      doneFans.push(fanUrl);
      const blockFanPromise = (async () => {
        try {
          await blockFan(fanUrl, anotherWindow, anotherLog);
        } catch (error) {
          console.log(error);
          const fanHandler = fanUrl.split('/').reverse()[0];
          const errorCaptionElem = anotherLog.appendChild(document.createElement('span'));
          errorCaptionElem.style.color = 'tomato';
          errorCaptionElem.textContent = ' ' + error.message;
          skippedList.push(fanHandler + ':' + error.message);
        }
      })();
      
      waitParallel.push(blockFanPromise);

      noneFound = false;

      if (waitParallel.length >= MAX_PARALLEL) break;
    }

    await Promise.all(waitParallel);

    if (noneFound) break;

    if (Date.now() - lastReport > 500) {
      const progressText =
        'Blocked ' + blockedList.length + ' (+' + (blockedList.length - blockedList.last.length) + ') of ' + allFans.length +
        (!skippedList.length ? '' : ', skipped ' + skippedList.length + ' (+' + (skippedList.length - skippedList.last.length) + ')') +
        (' ' + ((Date.now() - startBlocking) / 1000 / (blockedList.length + skippedList.length)).toFixed(3).replace(/0+$/, '') + '/sec' +
          (!skippedList.last.length ? '' : ' ++' + skippedList.last.filter(l => !/blocked/i.test(l)).join(', '))
        );
      currentStatus.textContent = progressText;
    console.log(progressText, { blocked: JSON.parse(JSON.stringify(blockedList)), skipped: JSON.parse(JSON.stringify(skippedList)) });

      blockedList.last = blockedList.slice();
      skippedList.last = skippedList.slice();

      lastReport = Date.now();
    }

    const baseLabel = currentStatus.textContent;
    currentStatus.textContent += ' \u23f3';
    await waitFor(Math.random() * 3000 + 300);
    currentStatus.textContent = baseLabel;
  }

  const progressText =
    'Blocked ' + blockedList.length + ' (+' + (blockedList.length - blockedList.last.length) + ') of ' + allFans.length +
    (!skippedList.length ? '' : ', skipped ' + skippedList.length + ' (+' + (skippedList.length - skippedList.last.length) + ')' +
      ' ' + skippedList.filter(l => !/blocked/i.test(l)).join(', ')
    ) +
    (' ' + ((Date.now() - startBlocking) / 1000 / (blockedList.length + skippedList.length)).toFixed(3).replace(/0+$/, '') + '/sec');
  
  currentStatus.textContent = progressText;
  console.log(
    progressText,
    { blocked: JSON.parse(JSON.stringify(blockedList)), skipped: JSON.parse(JSON.stringify(skippedList)) });

  await waitFor(300);

  const finishText =
    'All finished: \n\n' +
    'Blocked ' + blockedList.length + ' (+' + (blockedList.length - blockedList.last.length) + ')' +
    (!skippedList.length ? '' : ', skipped ' + skippedList.length + ' (+' + (skippedList.length - skippedList.last.length) + ')') +
    (' ' + ((Date.now() - startBlocking) / 1000 / (blockedList.length + skippedList.length)).toFixed(3).replace(/0+$/, '') + '/sec' +
      (!skippedList.length ? '\n - no exceptions.' : '\nexcept: ' + skippedList.join(' '))
    );
  console.log(finishText);
  progressPopup.contentElem.textContent = finishText;
  
  progressPopup.allowClosePopup();
  
  /**
   * @param {string} fanUrl
   * @param {Window} anotherWindow
   * @param {HTMLElement} progressReport
   */
  async function blockFan(fanUrl, anotherWindow, progressReport) {
    const fanHandler = fanUrl.split('/').reverse()[0];
    anotherWindow.location.href = fanUrl;

    progressReport.textContent = '';

    const progressFanHandlerElem = progressReport.appendChild(document.createElement('a'));
    progressFanHandlerElem.textContent = '  @' + fanHandler + ' ';
    progressFanHandlerElem.style.cssText = `
      color: cornflowerblue;
      text-decoration: none;
      cursor: pointer;`;
    progressFanHandlerElem.href = fanUrl;
    progressFanHandlerElem.target = '_blank';

    const progressStatusElem = progressReport.appendChild(document.createElement('span'));
    progressStatusElem.textContent = 'opening window...';

    await waitFor(() => anotherWindow.document.querySelector('h2[role=heading]'));

    const followingLabel = await waitFor(() =>
      anotherWindow.document.querySelector('[data-testid=placementTracking] [role=button]') ||
      [...anotherWindow.document.querySelectorAll('div[role=button]')].filter(div => /view profile/i.test(div.textContent || ''))[0]);

    if (/Following|Blocked/i.test(followingLabel?.textContent || '')) {
      progressStatusElem.textContent = 'already ' + followingLabel?.textContent + ', skip them.';
      skippedList.push(fanHandler + ':' + followingLabel?.textContent);
      return;
    }

    // load timeline
    const viewProfileOrMenu = await waitFor(() =>
      [...anotherWindow.document.querySelectorAll('div[aria-label]')].filter(label => /Timeline/.test(label.getAttribute('aria-label') || ''))[0] ||
      [...anotherWindow.document.querySelectorAll('div[data-testid=placementTracking]')].filter(div => div.textContent === 'Blocked')[0] ||
      [...anotherWindow.document.querySelectorAll('div[role=button]')].filter(div => /view profile/i.test(div.textContent || ''))[0]);

    if (viewProfileOrMenu && /view profile/i.test(viewProfileOrMenu.textContent || '')) {
      viewProfileOrMenu.click();
    }

    const menu = await waitFor(() => anotherWindow.document.querySelector('div[data-testid=userActions]'));
    progressStatusElem.textContent = '1. open context menu...';
    menu.click();
    const blockButton = await waitFor(() => anotherWindow.document.querySelector('div[role=menu] div[role=menuitem][data-testid=block]'));
    progressStatusElem.textContent = '2. click block...';
    blockButton.click();
    const blockConfirmButton = await waitFor(() => [
      ...anotherWindow.document.querySelectorAll('div[data-testid=confirmationSheetDialog] div[role=button] span')
    ].filter(btn => /Block/.test(btn.textContent || ''))[0]);
    progressStatusElem.textContent = '3. confirm block...';
    blockConfirmButton.click();
    await waitFor(() => [...anotherWindow.document.querySelectorAll('div[role=button]')].filter(btn => /Blocked/.test(btn.textContent || '')));
    blockedList.push(fanUrl.split('/').reverse()[0]);
    progressStatusElem.textContent = ' blocked.';
  }

  function waitFor(predicate, timeout) {
    if (predicate > 0) return new Promise(resolve => setTimeout(resolve, predicate));

    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timeoutAfter = start + ((timeout > 0 && timeout < 10 * 60 * 1000) ? timeout : 1000 * 60);
      const intervalHandle = setInterval(repeat, 300);
      async function repeat() {
        let result;
        try {
          result = await predicate();
        } catch (err0r) { return; }
        if (result && (result.length || typeof result.length !== 'number')) { // if it's an array, it better not be empty!
          clearInterval(intervalHandle);
          resolve(result);
        }
        else if (Date.now() > timeoutAfter) {
          clearInterval(intervalHandle);
          reject(new Error('Timed out ' + predicate));
        }
      }
    });
  }

  /**
 * @typedef {string | {
 *  tagName?: string;
 *  parentElement?: HTMLElement;
 *  children?: (HTMLElement | CreateElementDescr)[];
 *  [index: string]: any;
 * }} CreateElementDescr
 */

  /** @param descr {CreateElementDescr} */
  function createElement(descr) {
    if (typeof descr === 'string') return document.createElement(descr);
    const el = document.createElement(descr.tagName || 'div');
    for (const k in descr) {
      if (k === 'tagName' || k === 'parentElement' || k === 'children' || k in dummy) continue;
      else if (k in el.style) el.style[k] = descr[k];
      else el[k] = descr[k];
    }

    if (descr.children) {
      for (var childDescr of descr.children) {
        if (!childDescr) continue;
        const child = typeof /** @type {HTMLElement}*/(childDescr).appendChild === 'function' ? /** @type {HTMLElement}*/(childDescr) : createElement(/** @type { CreateElementDescr}*/(childDescr));
        el.appendChild(child);
      }
    }

    if (descr.parentElement) descr.parentElement.appendChild(el);
    return el;
  }
  /**
 * @typedef {string | {
 *  tagName?: string;
 *  parentElement?: HTMLElement;
 *  children?: (HTMLElement | CreateElementDescr)[];
 * [index: string]: any;
 * }} CreateElementDescr
 */

}

massBlock();
