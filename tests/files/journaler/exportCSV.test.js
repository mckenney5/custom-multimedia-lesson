const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('exportCSV', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should generate CSV report from log data', async () => {
    const result = await page.evaluate(() => {
      journaler._userID = "reportUser789";
      journaler._startTime = Date.parse('2023-01-01T12:00:00Z');
      journaler._currentLog = [
        "0,a,vid1",
        "5,1,5",
        "10,b,vid1"
      ];
      const csvReport = journaler.report("user123", journaler._currentLog, journaler._startTime);
      if (!Array.isArray(csvReport) || csvReport.length < 2) return false;
      const headerOk = csvReport[0][0] === "ID" && csvReport[0][1] === "Time Stamp";
      const row1Ok = csvReport[1][0] === "user123" && csvReport[1][2] === "VIDEO_PLAY";
      return headerOk && row1Ok;
    });
    expect(result).toBe(true);
  });

  test('should export CSV with correct filename and BOM', async () => {
    const result = await page.evaluate(() => {
      journaler._userID = 'testUser123';
      const testCSV = [['ID', 'Name'], ['user1', 'John']];
      let capturedDownload = null;
      const originalCreateElement = document.createElement;
      document.createElement = (tag) => {
        const el = originalCreateElement.call(document, tag);
        if (tag === 'a') {
          Object.defineProperty(el, 'download', {
            set(v) { capturedDownload = v; },
            get() { return capturedDownload; }
          });
          el.click = () => {};
        }
        return el;
      };
      let capturedBlob = null;
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = (blob) => { capturedBlob = blob; return originalCreateObjectURL.call(URL, blob); };
      try {
        journaler.exportCSV(testCSV);
        const filenameOk = capturedDownload === `${journaler._userID}.data.csv`;
        const bomOk = capturedBlob && capturedBlob.type === "text/plain;charset=utf-8";
        return filenameOk && bomOk;
      } finally {
        document.createElement = originalCreateElement;
        URL.createObjectURL = originalCreateObjectURL;
      }
    });
    expect(result).toBe(true);
  });

  test('should use default filename when userID is empty', async () => {
    const result = await page.evaluate(() => {
      journaler._userID = '';
      const testCSV = [['ID']];
      let capturedDownload = null;
      const originalCreateElement = document.createElement;
      document.createElement = (tag) => {
        const el = originalCreateElement.call(document, tag);
        if (tag === 'a') {
          Object.defineProperty(el, 'download', {
            set(v) { capturedDownload = v; },
            get() { return capturedDownload; }
          });
          el.click = () => {};
        }
        return el;
      };
      try {
        journaler.exportCSV(testCSV);
        return capturedDownload === '.data.csv';
      } finally {
        document.createElement = originalCreateElement;
      }
    });
    expect(result).toBe(true);
  });
});
