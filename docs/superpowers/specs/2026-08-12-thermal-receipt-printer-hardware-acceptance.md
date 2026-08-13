# Thermal Receipt Printer Driver — Hardware Acceptance Checklist

Run against real hardware before treating `feat/thermal-receipt-printer-driver`
as production-ready. None of these have been verified by the agent that wrote
the driver — verify each yourself and record pass/fail + notes.

## Android

- [ ] USB: scan finds a connected USB thermal printer, connect succeeds, test
      print produces readable output with visible paper feed and cut.
- [ ] Bluetooth: permission prompt appears on first scan (fresh install),
      scan finds a paired/nearby printer, connect succeeds, test print
      produces readable output with visible paper feed and cut.
- [ ] Bluetooth, no printer nearby/paired: scan shows a normal empty state,
      not an error message.
- [ ] Bluetooth, permission denied: deny the prompt — app shows an error
      state, does not hang or crash.
- [ ] LAN: enter IP/port manually, connect succeeds, test print produces
      readable output with visible paper feed and cut.
- [ ] Vietnamese diacritics ("Cà phê sữa đá", "Trà đào cam sả") print
      correctly, not as `?` or mojibake.
- [ ] Reconnect after force-closing and reopening the app, for each
      connection type above.
- [ ] Any operation (connect, scan, test print) that appears to hang for more
      than ~10 seconds is noted explicitly — do not assume it will eventually
      resolve.

## iOS

- [ ] Bluetooth: system permission prompt appears, scan finds a
      paired/nearby printer, connect succeeds, test print produces readable
      output with visible paper feed and cut.
- [ ] Bluetooth, no printer nearby/paired: scan shows a normal empty state,
      not an error message (verify the same behavior as Android, though
      native implementation may differ).
- [ ] LAN: enter IP/port manually, connect succeeds, test print produces
      readable output with visible paper feed and cut.
- [ ] Vietnamese diacritics print correctly.
- [ ] Reconnect after force-closing and reopening the app, for LAN and
      Bluetooth.
- [ ] Any operation (connect, scan, test print) that appears to hang for more
      than ~10 seconds is noted explicitly — do not assume it will eventually
      resolve.
- [ ] Confirm USB is correctly reported as unsupported (no crash, a clear
      Vietnamese error message) since the library doesn't support USB on iOS.

## Sign-off

Record the printer model(s), connection type(s), and Android/iOS versions
tested, plus the date and who ran the checklist.
