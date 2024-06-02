import { createInterface } from "readline";
import fs from "fs/promises";
import chalk from "chalk";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const gold = chalk.hex("#FFD700").bold;

let amount;
let baseCurrency;
let targetCurrency;
let rate;
let date;
const exchangeRates = {};

// checks if the date input is valid
function dateValidation(date) {
  const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  return regex.test(date);
}

const args = process.argv.slice(2);

//checks if user wrote a date and if it's in valid format
if (args.length === 0) {
  console.log("Enter date in format YYYY-MM-DD");
  rl.close();
} else if (!dateValidation(args[0])) {
  console.log("Not valid format of date");
  rl.close();
} else {
  date = args[0];
}


// function to write the data to conversions.json
const writeData = async (date, amount, base, target, convertedAmount) => {
  const convertedData = {
    date: date,
    amount: amount,
    base_currency: base,
    target_currency: target,
    converted_amount: convertedAmount,
  };

  const response = await fs.readFile("conversions.json");
  const conversions = await JSON.parse(response);
  conversions.push(convertedData);
  await fs.writeFile(
    "conversions.json",
    JSON.stringify(conversions, null, 2),
    "utf-8"
  );
};

//checks the exchange rate of base currency to the target currency
const fetchMultiRate = async (from, to, api) => {
  const response = await fetch(
    `https://api.fastforex.io/fetch-multi?from=${from}&to=${to}&api_key=${api}`
  );
  const data = await response.json();
  const rate = parseFloat(Object.values(data.results));
  return rate;
};

//check if amount is correct
const validateAmount = (data) => {
  const regex = /^\d+(\.\d{1,2})?$/;
  return regex.test(data);
};

//extract api key from config.json
async function getApiKey() {
  try {
    const data = await fs.readFile("config.json");
    const parsedData = await JSON.parse(data);
    return parsedData.fast_forex.api_key;
  } catch (err) {
    throw new Error(err);
  }
}

//fetch all currencies to check if user wrote the correct format of a currency
const fetchAllCurrencies = async (input) => {
  try {
    const apiKey = await getApiKey();
    const response = await fetch(
      `https://api.fastforex.io/fetch-all?api_key=${apiKey}`
    );
    const data = await response.json();
    const currencies = Object.keys(data.results);
    return currencies.includes(input);
  } catch (err) {
    throw new Error(err);
  }
};

//checks if the user wrote the correct format of the amount
function amountInput() {
  rl.on("line", (input) => {
    if (input.toLocaleLowerCase() === "end") {
      rl.close();
      return;
    }
    if (!validateAmount(input)) {
      console.log("Please enter a valid amount");
    } else {
      amount = parseFloat(input);
      rl.removeAllListeners("line");
      baseCurrencyInput();
    }
  });
}

//checks if user wrote correct base currency
function baseCurrencyInput() {
  rl.on("line", async (input) => {
    if (input.toLocaleLowerCase() === "end") {
      rl.close();
      return;
    }
    try {
      const currency = input.toUpperCase();
      const fetchedCurrencies = await fetchAllCurrencies(currency);
      if (!fetchedCurrencies) {
        console.log("Please enter a valid currency code");
      } else {
        baseCurrency = currency;
        if (!exchangeRates[baseCurrency]) {
          exchangeRates[baseCurrency] = {};
        }
        rl.removeAllListeners("line");
        targetCurrencyInput();
      }
    } catch (err) {
      throw new Error(err);
    }
  });
}

//checks if user wrote correct target currency, if so checks if we have the exchange rate cached or we have to fetch it and writes it to conversions.json
function targetCurrencyInput() {
  rl.on("line", async (input) => {
    if (input.toLocaleLowerCase() === "end") {
      rl.close();
      return;
    }
    try {
      const currency = input.toUpperCase();
      const fetchedCurrencies = await fetchAllCurrencies(currency);

      if (!fetchedCurrencies) {
        console.log("Please enter a valid currency code");
      } else {
        targetCurrency = currency;

        if (!exchangeRates[baseCurrency][targetCurrency]) {
          try {
            const api = await getApiKey();
            rate = await fetchMultiRate(baseCurrency, targetCurrency, api);
            const convertedAmount = (amount * rate).toFixed(2);
            exchangeRates[baseCurrency][targetCurrency] = rate;
            const result = `${gold(amount)} ${baseCurrency} is ${gold(
              convertedAmount
            )} ${targetCurrency}`;

            //writes the data to conversions.json
            await writeData(
              date,
              amount,
              baseCurrency,
              targetCurrency,
              Number(convertedAmount)
            );
            console.log(result);
            rl.removeAllListeners("line");
            amountInput();
          } catch (err) {
            throw new Error(err);
          }
        } else {
          rate = exchangeRates[baseCurrency][targetCurrency];
          const convertedAmount = (amount * rate).toFixed(2);
          const result = `${gold(amount)} ${baseCurrency} is ${gold(
            convertedAmount
          )} ${targetCurrency}`;

          //writes the data to conversions.json
          await writeData(
            date,
            amount,
            baseCurrency,
            targetCurrency,
            Number(convertedAmount)
          );
          console.log(result);
          rl.removeAllListeners("line");
          amountInput();
        }
      }
    } catch (err) {
      throw new Error(err);
    }
  });
}
amountInput();
