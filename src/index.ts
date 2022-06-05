import { chromium } from 'playwright';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { createTransport } from 'nodemailer';

dayjs.extend(customParseFormat);

require('dotenv').config();

const sendEmail = async () => {
  const transporter = createTransport({
    host: 'smtp.gmail.com',
    service: 'gmail',
    port: 587,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  await transporter.sendMail({
    from: '"Flight Delay Detector" <automated@flightdelaydetector.com>',
    to: process.env.EMAIL_TO,
    subject: 'Flight Delay Detector',
    html: `
    <html>
      <div>The flight has been delayed, for more info: https://www.flightradar24.com/data/flights/${process.env.FLIGHT_ID}</div>
    </html>
    `,
  });
};

(async () => {
  const browser = await chromium.launch({ headless: !!process.env.CI });
  const page = await browser.newPage();
  await page.goto(`https://www.flightradar24.com/data/flights/${process.env.FLIGHT_ID}`);

  const rows = await page.locator('#tbl-datatable > tbody > tr');
  const rowsHandler = await rows.elementHandles();

  for (const row of rowsHandler) {
    const dateNode = await row.$('td:nth-child(3)');
    const date = await dateNode.textContent();

    const timeNode = await row.$('td:nth-child(8)');
    const time = await timeNode.textContent();

    const status: string = await row.$eval('td:nth-child(11) .state-block', (node) => node.className);

    const requestedDate = dayjs(process.env.FLIGHT_DATE).format('DD MMM YYYY');
    const requestedTime = dayjs(process.env.FLIGHT_TIME, 'HH:mm').format('h:mm A');

    if (date === requestedDate && time === requestedTime) {
      if (!status.includes('gray') && !status.includes('green')) {
        await sendEmail();
      }

      break;
    }
  }

  process.exit(0);
})();
