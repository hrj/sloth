# Sloth

A simple chrome / chromium plugin which ensures that tabs are lazily loaded.

Requires Chrome 54+.

# How it works

This plugin uses the `discard` API available since Chrome 54. All tabs except
new tabs or "special" tabs are discarded. Discarded tabs are visible in the tab
bar, but not loaded from the network nor kept in memory.

If a window doesn't have a new tab, it is created and activated. This prevents
any tab from loading during startup, unless you explicitly select it.

Special tabs are those with `chrome://` URLs, for example.

# How to Install

From the release page, download the zip file and extract it somewhere on your file-system. Go to `chrome://extensions` and click
`Load Unpacked extension`, select the `slot` directory and press `Ok`.

# History

I found an extension called Native Lazy Tabs [here](https://www.crx4chrome.com/extensions/ianooggapgmmmfojacmhnfaheidgpbki/). It was
distributed under the GPL license. I adapted it and added the "new tab" feature.

The icon is by Jaime Serra, distributed under the CC license.
