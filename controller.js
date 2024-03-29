// identifier will be posted with the order list, to prevent other with the extension to post their own version of list again
// this identifier is made with some "hidden" utf-8 characters so they are not visible to human
const SHUFFLER_ON_IDENTIFIER = '﻿';
const SHUFFLER_OFF_IDENTIFIER = '­';

const SELECTORS = {
  toolbar: ".jsNRx .tMdQNe",
  panelButtons: "[jsname=A5il2e]",
  sidePanel: "[jscontroller=ZUdl0b]",
  participantsPanel: "[jsname=jrQDbd]",
  participants: "[jsname=jrQDbd] .zSX24d .zWGUib",
  chatPanel: ".z38b6",
};

const shufflerButtonWrapperClass = "r6xAKc";
const shufflerButtonClass = "VfPpkd-Bz112c-LgbsSe yHy1rc eT1oJ JsuyRc boDUxc";

let attendeeCount = 0;
let shufflerBtn;
let participants = [];
let shuffledParticipants = [];
let shuffledOriginator = null;
let isExtensionEnabled = true; // this will be set to false when the extension see someone else posting message with the "identifier"

function pressEnter(element) {
  const ev = new KeyboardEvent('keydown', {
    altKey:false,
    bubbles: true,
    cancelBubble: false,
    cancelable: true,
    charCode: 0,
    code: "Enter",
    composed: true,
    ctrlKey: false,
    currentTarget: null,
    defaultPrevented: true,
    detail: 0,
    eventPhase: 0,
    isComposing: false,
    isTrusted: true,
    key: "Enter",
    keyCode: 13,
    location: 0,
    metaKey: false,
    repeat: false,
    returnValue: false,
    shiftKey: false,
    type: "keydown",
    which: 13
  });

  element.dispatchEvent(ev);
}

function sendMessage(...msg) {
  const inputField = document.querySelector(`${SELECTORS.sidePanel} textarea`)
  if (!inputField) return;

  inputField.focus();
  inputField.value = msg.join('');
  inputField.dispatchEvent(new Event('input', {
    bubbles: true,
    cancelable: true,
  }));
  pressEnter(inputField);
}

let shufflerStartedLocally = false;
function cmdShuffle() {
  if (shufflerBtn.getAttribute('aria-pressed') === 'true') {
    stopShuffler();
  } else {
    startShuffler();
  }
}

function startShuffler() {
  if (!isExtensionEnabled) return;
  const chatButton = document.querySelectorAll(SELECTORS.panelButtons)[2];
  if (chatButton.getAttribute('aria-pressed') === 'false') {
    chatButton.click();
  }

  const participantsToShuffle = participants.filter(participant => !shuffledParticipants.includes(participant));
  shuffledParticipants = [
    ...shuffledParticipants,
    ...[...participantsToShuffle].sort(() => Math.random() - 0.5),
  ];

  sendMessage(SHUFFLER_ON_IDENTIFIER, shuffledParticipants.join('\n'));
  shufflerStartedLocally = true;
  shufflerBtn.setAttribute('aria-pressed', 'true');
}

function stopShuffler() {
  if (!isExtensionEnabled) return;
  sendMessage(SHUFFLER_OFF_IDENTIFIER, 'Shuffler Off');
  shuffledParticipants = [];
  shuffledOriginator = null;
  shufflerStartedLocally = false;
  shufflerBtn.setAttribute('aria-pressed', 'false');
}

function cmdPick(n) {
  const chatButton = document.querySelectorAll(SELECTORS.panelButtons)[2];
  if (chatButton.getAttribute('aria-pressed') === 'false') {
    chatButton.click();
  }

  const randomParticipants = [...participants].sort(() => Math.random() - 0.5).slice(0, n);

  sendMessage(randomParticipants.join('\n'));
}

function onParticipantJoined() {
  if (!isExtensionEnabled) return;

  if (shufflerStartedLocally) {
    startShuffler();
  }
}

function onParticipantLeft() {
  if (shuffledOriginator && !participants.includes(shuffledOriginator)) {
    isExtensionEnabled = true;
    shufflerBtn.setAttribute('aria-pressed', 'false');
    shuffledOriginator = null;
  }
}

function updateParticipants() {
  const newParticipants = [...document.querySelectorAll(SELECTORS.participants)]
    .map(e => e.textContent)
    .sort()
    .filter((v, i, a) => a.indexOf(v) === i);

  const someoneJoined = participants.length < newParticipants.length;
  const someoneLeft = participants.length > newParticipants.length;
  participants = newParticipants;

  if (someoneJoined) {
    onParticipantJoined();
  } else if (someoneLeft) {
    onParticipantLeft();
  }
}

function onNewMessage(message) {
  if (!isExtensionEnabled) return;

  if (message.author !== 'You' && message.content.startsWith(SHUFFLER_ON_IDENTIFIER)) {
    isExtensionEnabled = false;
    shufflerBtn.setAttribute('aria-pressed', 'true');

    shuffledParticipants = message.content.split('\n');
    shuffledOriginator = message.author;
    return;
  }

  if (message.author !== 'You' && message.content.startsWith(SHUFFLER_OFF_IDENTIFIER)) {
    isExtensionEnabled = true;
    shufflerBtn.setAttribute('aria-pressed', 'false');

    shuffledParticipants = [];
    shuffledOriginator = null;
    return;
  }

  const msg = message.content.toLowerCase();
  let match;
  if (message.author === 'You' && (msg === '/shuffler' || msg === '/shuffler on')) {
    shuffledParticipants = [];
    startShuffler();
  } else if (message.author === 'You' && msg === '/shuffler off') {
    stopShuffler();
  } else if (msg === '/relist') {
    if (shufflerStartedLocally) {
      sendMessage(shuffledParticipants.join('\n'));
    } else {
      sendMessage('We have not shuffled yet.');
    }
  } else if (match = msg.match(/^\/pick ([0-9]+)$/)) {
    if (participants.length > 1) {
      cmdPick(parseInt(match[1], 10));
    } else {
      sendMessage('No one to pick from');
    }
  }
}

async function observeParticipants() {
  // Open up the Participants panel at least once so that we can observe it...
  if (!document.querySelector(SELECTORS.participantsPanel)) {
    await new Promise(resolve => {
      const intervalId = setInterval(() => {
        document.querySelectorAll(SELECTORS.panelButtons)[1].click();
        if (document.querySelector(SELECTORS.participantsPanel)) {
          clearInterval(intervalId);
          resolve();
        }
      }, 50);
    });
  }

  // get initial participants
  updateParticipants();

  // Look for any change in the Participants panel
  const observer = new MutationObserver(updateParticipants);
  observer.observe(document.querySelector(SELECTORS.participantsPanel), { childList: true });
}

async function observeMessages() {
  // Open up the Chat panel at least once so that we can observe it...
  if (!document.querySelector(SELECTORS.chatPanel)) {
    await new Promise(resolve => {
      const intervalId = setInterval(() => {
        document.querySelectorAll(SELECTORS.panelButtons)[2].click();
        if (document.querySelector(SELECTORS.chatPanel)) {
          clearInterval(intervalId);
          resolve();
        }
      }, 50);
    });
  }

  // Look for any change in the Chat panel
  const observer = new MutationObserver(() => {
    const messageEl = document.querySelector(SELECTORS.chatPanel).lastChild;
    const author = messageEl.firstChild.firstChild.innerText;
    const time = messageEl.firstChild.lastChild.innerText;
    const content = messageEl.lastChild.lastChild.innerText;

    if (time === 'You') return;

    onNewMessage({ author, time, content });
  });
  observer.observe(document.querySelector(SELECTORS.chatPanel), { subtree: true, childList: true });
}

async function injectExtension() {
  if (shufflerBtn) return;

  const toolbar = document.querySelector(SELECTORS.toolbar);
  if (!toolbar) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div
      class="shuffler-button-wrapper ${shufflerButtonWrapperClass}"
    >
      <button id="shuffler-button"
        class="shuffler-button ${shufflerButtonClass}"
        aria-pressed="false"
      >
        <span class="tooltip">Shuffler</span>
      </button>
    </div>`;
  shufflerBtn = wrapper.firstElementChild.firstElementChild;
  shufflerBtn.onclick = () => {
    if (!isExtensionEnabled) return;
    cmdShuffle();
  };

  toolbar.insertBefore(wrapper, toolbar.firstElementChild);

  await observeParticipants();
  await observeMessages();
}

window.addEventListener('message', e => {
  const intervalId = setInterval(() => {
    const toolbar = document.querySelector(SELECTORS.toolbar);
    if (toolbar) {
      clearInterval(intervalId);
      injectExtension();
    }
  }, 250);
});
