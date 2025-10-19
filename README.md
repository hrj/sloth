<h1><img src="https://github.com/hrj/sloth/raw/master/img/icon48.png"></img> Sloth</h1>

A light-weight chrome / chromium plugin which ensures that tabs are lazily loaded.

Tested with Chrome/Chromium 138.x

## How it works

This plugin uses the `discard` API available since Chrome 54. All tabs except
new tabs or "special" tabs are discarded. Discarded tabs are visible in the tab
bar, but not loaded from the network nor kept in memory.

If a window doesn't have a new tab, it is created and activated. This prevents
any tab from loading during startup, unless you explicitly select it.

Special tabs are those with `chrome://` URLs, for example.

Note: When there are hundreds of tabs open in the session, a couple of them manage to sneak through and become active. This is a limitation due to Chromium's design. See https://github.com/hrj/sloth/issues/1.

## Install from the Chrome Web Store
You can install the extension from the [Chrome Store](https://chrome.google.com/webstore/detail/sloth/filkeckmpdjogddcamkafnekhgfaehkc).

## How to Install Locally
If you can't / don't want to use the Chrome Store, you can install it manually as follows.

From the release page, download the zip file and extract it somewhere on your file-system. Go to `chrome://extensions` and click
`Load Unpacked extension`, select the `slot` directory and press `Ok`.

## History / Credits

I found an extension called Native Lazy Tabs [here](https://www.crx4chrome.com/extensions/ianooggapgmmmfojacmhnfaheidgpbki/). It was
distributed under the GPL license. I adapted it and added the "new tab" feature.

The icon is by Jaime Serra, distributed under the CC license.
