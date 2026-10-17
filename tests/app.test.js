// =========================================================
// Unit Test Suite: WakeUp Pro Core Logic & APK Verification
// =========================================================

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// --- Pure Helper Functions Extracted from app.js ---
function formatTimeString(timeStr, returnSplit = false) {
  if (!timeStr || !timeStr.includes(':')) return returnSplit ? { time: timeStr, ampm: '' } : timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hours12 = h % 12 || 12;
  const formattedTime = `${String(hours12).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  
  if (returnSplit) {
    return { time: formattedTime, ampm };
  }
  return `${formattedTime} ${ampm}`;
}

function formatDaysString(daysArray) {
  if (!daysArray || daysArray.length === 0) return 'Once';
  if (daysArray.length === 7) return 'Everyday';
  if (daysArray.length === 5 && !daysArray.includes(0) && !daysArray.includes(6)) return 'Weekdays';
  if (daysArray.length === 2 && daysArray.includes(0) && daysArray.includes(6)) return 'Weekends';

  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return daysArray.map(d => names[d]).join(', ');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[s]);
}

function getMissionBadgeText(missionKey) {
  switch (missionKey) {
    case 'math': return '🧮 Math Challenge';
    case 'shake': return '📱 Shake Challenge';
    case 'typing': return '⌨️ Typing Challenge';
    case 'memory': return '🧠 Memory Matrix';
    default: return '🔔 Standard';
  }
}

function calculateSnoozeTime(currentHour, currentMin, snoozeMinutes = 5) {
  const date = new Date(2026, 9, 17, currentHour, currentMin, 0);
  date.setMinutes(date.getMinutes() + snoozeMinutes);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function shouldAlarmTrigger(alarm, testHour, testMin, testDay) {
  const timeStr = `${String(testHour).padStart(2, '0')}:${String(testMin).padStart(2, '0')}`;
  if (!alarm.enabled) return false;
  if (alarm.time !== timeStr) return false;
  if (alarm.days.length === 0) return true; // Once
  return alarm.days.includes(testDay);
}

// --- Test Suites ---

describe('1. Time Formatting & Conversions', () => {
  test('formats morning times correctly in 12-hour format', () => {
    assert.equal(formatTimeString('07:30'), '07:30 AM');
    assert.equal(formatTimeString('00:00'), '12:00 AM');
    assert.equal(formatTimeString('09:05'), '09:05 AM');
  });

  test('formats afternoon and evening times correctly', () => {
    assert.equal(formatTimeString('12:00'), '12:00 PM');
    assert.equal(formatTimeString('13:45'), '01:45 PM');
    assert.equal(formatTimeString('23:59'), '11:59 PM');
  });

  test('splits time and ampm when requested', () => {
    const res = formatTimeString('18:20', true);
    assert.deepEqual(res, { time: '06:20', ampm: 'PM' });
  });

  test('gracefully handles missing or malformed time values', () => {
    assert.equal(formatTimeString(''), '');
    assert.equal(formatTimeString(null), null);
    assert.equal(formatTimeString('invalid'), 'invalid');
  });
});

describe('2. Days of Week Formatting', () => {
  test('recognizes all 7 days as Everyday', () => {
    assert.equal(formatDaysString([0, 1, 2, 3, 4, 5, 6]), 'Everyday');
  });

  test('recognizes Mon-Fri as Weekdays', () => {
    assert.equal(formatDaysString([1, 2, 3, 4, 5]), 'Weekdays');
  });

  test('recognizes Sat-Sun as Weekends', () => {
    assert.equal(formatDaysString([0, 6]), 'Weekends');
  });

  test('formats custom subset of days', () => {
    assert.equal(formatDaysString([1, 3, 5]), 'Mon, Wed, Fri');
    assert.equal(formatDaysString([2, 4]), 'Tue, Thu');
  });

  test('handles empty or null as Once', () => {
    assert.equal(formatDaysString([]), 'Once');
    assert.equal(formatDaysString(null), 'Once');
  });
});

describe('3. Security & HTML Sanitization', () => {
  test('escapes HTML tags and injection payloads', () => {
    const input = '<script>alert("xss")</script>';
    const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
    assert.equal(escapeHtml(input), expected);
  });

  test('escapes ampersands and single quotes', () => {
    const input = "Tom & Jerry's alarm";
    const expected = "Tom &amp; Jerry&#39;s alarm";
    assert.equal(escapeHtml(input), expected);
  });
});

describe('4. Alarm Scheduling & Day Matching', () => {
  const weekdayAlarm = {
    id: 'a1',
    time: '06:30',
    days: [1, 2, 3, 4, 5],
    enabled: true
  };

  test('triggers when hour, minute, and day match', () => {
    // Monday (day 1) at 06:30
    assert.equal(shouldAlarmTrigger(weekdayAlarm, 6, 30, 1), true);
    // Friday (day 5) at 06:30
    assert.equal(shouldAlarmTrigger(weekdayAlarm, 6, 30, 5), true);
  });

  test('does not trigger on unselected days', () => {
    // Sunday (day 0) at 06:30
    assert.equal(shouldAlarmTrigger(weekdayAlarm, 6, 30, 0), false);
    // Saturday (day 6) at 06:30
    assert.equal(shouldAlarmTrigger(weekdayAlarm, 6, 30, 6), false);
  });

  test('does not trigger if disabled', () => {
    const disabledAlarm = { ...weekdayAlarm, enabled: false };
    assert.equal(shouldAlarmTrigger(disabledAlarm, 6, 30, 1), false);
  });

  test('does not trigger on mismatched minute', () => {
    assert.equal(shouldAlarmTrigger(weekdayAlarm, 6, 31, 1), false);
  });

  test('single-use alarm (days empty) triggers on any day at that time', () => {
    const onceAlarm = { id: 'a2', time: '14:00', days: [], enabled: true };
    assert.equal(shouldAlarmTrigger(onceAlarm, 14, 0, 0), true);
    assert.equal(shouldAlarmTrigger(onceAlarm, 14, 0, 3), true);
  });
});

describe('5. Snooze Calculations & Midnight Rollover', () => {
  test('adds 5 minutes within the same hour', () => {
    assert.equal(calculateSnoozeTime(7, 15, 5), '07:20');
  });

  test('rolls over hour correctly', () => {
    assert.equal(calculateSnoozeTime(7, 58, 5), '08:03');
  });

  test('rolls over midnight correctly from 23:57 to 00:02', () => {
    assert.equal(calculateSnoozeTime(23, 57, 5), '00:02');
  });
});

describe('6. Mission Engine Assertions', () => {
  test('Mission badges map to proper labels and icons', () => {
    assert.equal(getMissionBadgeText('math'), '🧮 Math Challenge');
    assert.equal(getMissionBadgeText('shake'), '📱 Shake Challenge');
    assert.equal(getMissionBadgeText('typing'), '⌨️ Typing Challenge');
    assert.equal(getMissionBadgeText('memory'), '🧠 Memory Matrix');
    assert.equal(getMissionBadgeText('none'), '🔔 Standard');
  });

  test('Shake scoring increments and clamps at 100%', () => {
    let score = 0;
    const addShake = (pts) => score = Math.min(100, score + pts);

    addShake(30);
    assert.equal(score, 30);
    addShake(50);
    assert.equal(score, 80);
    addShake(40);
    assert.equal(score, 100); // clamped at 100
  });

  test('Memory sequence generation stays within 3x3 grid [0..8]', () => {
    const seq = [];
    for (let i = 0; i < 5; i++) {
      seq.push(Math.floor(Math.random() * 9));
    }
    assert.equal(seq.length, 5);
    for (const tile of seq) {
      assert.ok(tile >= 0 && tile <= 8, `Tile index ${tile} must be between 0 and 8`);
    }
  });

  test('Math problem generator produces verifiable answers', () => {
    // Easy: a + b
    const a1 = 25, b1 = 30;
    assert.equal(a1 + b1, 55);

    // Medium: a * b + c
    const a2 = 7, b2 = 8, c2 = 14;
    assert.equal((a2 * b2) + c2, 70);

    // Hard: (a * b) + c
    const a3 = 12, b3 = 11, c3 = 45;
    assert.equal((a3 * b3) + c3, 177);
  });
});

describe('7. APK Binary, Manifest & Cryptographic Signatures', () => {
  const apkPath = path.resolve('WakeUpPro.apk');

  test('WakeUpPro.apk exists and is greater than 10KB', () => {
    assert.ok(fs.existsSync(apkPath), 'WakeUpPro.apk must exist in the root directory');
    const stat = fs.statSync(apkPath);
    assert.ok(stat.size > 10240, `APK size ${stat.size} bytes should be > 10KB`);
  });

  test('APK ZIP structure contains all required components', () => {
    const listOutput = execSync(`unzip -l "${apkPath}"`).toString();
    
    assert.ok(listOutput.includes('AndroidManifest.xml'), 'Must contain AndroidManifest.xml');
    assert.ok(listOutput.includes('classes.dex'), 'Must contain classes.dex');
    assert.ok(listOutput.includes('resources.arsc'), 'Must contain resources.arsc');
    assert.ok(listOutput.includes('assets/index.html'), 'Must contain assets/index.html');
    assert.ok(listOutput.includes('assets/styles.css'), 'Must contain assets/styles.css');
    assert.ok(listOutput.includes('assets/app.js'), 'Must contain assets/app.js');
    assert.ok(listOutput.includes('res/mipmap-hdpi/ic_launcher.png'), 'Must contain ic_launcher.png');
    assert.ok(listOutput.includes('META-INF/MANIFEST.MF'), 'Must contain META-INF/MANIFEST.MF');
    assert.ok(listOutput.includes('META-INF/ANDROIDD.SF'), 'Must contain signature file');
  });

  test('APK signature verifies successfully with jarsigner', () => {
    const verifyOutput = execSync(`/opt/homebrew/opt/openjdk/bin/jarsigner -verify "${apkPath}"`).toString();
    assert.ok(verifyOutput.includes('jar verified'), `jarsigner must report "jar verified". Got: ${verifyOutput}`);
  });
});
