const TelegramBot = require("node-telegram-bot-api");
const puppeteer = require("puppeteer");
require("dotenv").config(); // Загрузка переменных окружения из .env

// Токен вашего бота
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const urlBase = "https://bina.az/baki/nizami/8-ci-kilometr/alqi-satqi/menziller";

const maxPages = 0; // Установите количество страниц для скрейпинга

let lastFetchedData = []; // Хранилище для предыдущих данных

const scrapeData = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  let currentPageUrl = urlBase;
  const allItems = [];
  let currentPage = 0;

  while (currentPage <= maxPages) {
    console.log(`Сбор данных со страницы: ${currentPageUrl}`);

    try {
      await page.goto(currentPageUrl, { waitUntil: "networkidle2" });

      const items = await page.evaluate(() => {
        const elements = document.querySelectorAll(".items-i");
        return Array.from(elements).map((element, index) => {
          const location =
            element.querySelector(".location")?.innerText.trim() ||
            "Не найдено";
          const price =
            element.querySelector(".price-val")?.innerText.trim() ||
            "Не найдено";
          const descriptionItems = Array.from(
            element.querySelectorAll(".name li")
          )
            .map((li) => li.innerText.trim())
            .join(", ");

          const link = element.querySelector("a").href;

          const imageElements = element.querySelectorAll(".slider_image img");
          const imageUrls = Array.from(imageElements).map((img) =>
            img.src.startsWith("data:") ? img.getAttribute("data-src") : img.src
          );

          return {
            id: index,
            location,
            price,
            description: descriptionItems,
            images: imageUrls,
            link,
          };
        });
      });

      allItems.push(...items);

      const nextPageLink = await page.evaluate(() => {
        const nextLinkElement = document.querySelector(
          "nav.pagination .next a"
        );
        return nextLinkElement ? nextLinkElement.href : null;
      });

      if (nextPageLink) {
        currentPageUrl = nextPageLink;
        currentPage++;
        console.log(`Переход на следующую страницу: ${currentPageUrl}`);
      } else {
        console.log("Последняя страница достигнута.");
        break; // Выход из цикла, если больше нет страниц
      }
    } catch (error) {
      console.error(
        `Ошибка при сборе данных с ${currentPageUrl}: ${error.message}`
      );
      break; // Прерывание в случае критической ошибки
    }
  }

  await browser.close();
  return allItems; // Возвращаем собранные данные
};

const checkForNewData = async (chatId) => {
  const newData = await scrapeData();

  // Сравнение с предыдущими данными
  const newItems = newData.filter(
    (item) => !lastFetchedData.some((oldItem) => oldItem.link === item.link)
  );

  if (newItems.length > 0) {
    newItems.forEach(async (item) => {
      await bot.sendMessage(
        chatId,
        `Новая запись:\n${item.description}\n${item.link}`
      );
    });

    // Обновляем данные
    lastFetchedData = [...lastFetchedData, ...newItems];
  } else {
    console.log("Новых данных не найдено.");
  }
};

const startDataCheck = (chatId) => {
  setInterval(() => checkForNewData(chatId), 60000); // Проверка каждые 60000 мс (1 минута)
};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Бот запущен. Начинаю сбор данных...");
  startDataCheck(chatId); // Запускаем процесс сбора данных
});

bot.on("message", (msg) => {
  console.log(`Получено сообщение от ${msg.from.first_name}: ${msg.text}`);
});

console.log("Бот работает...");
