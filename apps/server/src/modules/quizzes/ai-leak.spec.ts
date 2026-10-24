import { describe, expect, it } from "vitest";
import { choiceLeaks, containsPhrase, typedLeaks } from "./ai-leak";

describe("AI answer leaks", () => {
  it("matches whole words, ignoring case, accents and punctuation", () => {
    expect(containsPhrase("Wo liegt São Paulo?", "sao paulo")).toBe(true);
    expect(containsPhrase("Parisian food", "Paris")).toBe(false);
  });

  it("flags the correct answer in the question or the quiz title", () => {
    expect(
      choiceLeaks("Europe", "Paris is the capital of which country?", "Paris", [
        "Rome",
        "Madrid",
        "Berlin",
      ]),
    ).toBe(true);
    expect(
      choiceLeaks("Paris trivia", "Which city has the Eiffel Tower?", "Paris", [
        "Rome",
        "Madrid",
        "Berlin",
      ]),
    ).toBe(true);
  });

  it("flags a telling word only when no wrong answer shares it", () => {
    const wrong = ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"];
    expect(
      choiceLeaks("Geo", "Which is the largest ocean?", "Pacific Ocean", wrong),
    ).toBe(false);
    expect(
      choiceLeaks(
        "Geo",
        "Which ocean did Magellan call 'pacific'?",
        "Pacific Ocean",
        wrong,
      ),
    ).toBe(true);
  });

  it("lets a clean question through", () => {
    expect(
      choiceLeaks("Art", "Who painted the Mona Lisa?", "Leonardo da Vinci", [
        "Michelangelo",
        "Raphael",
        "Titian",
      ]),
    ).toBe(false);
  });

  it("checks every accepted typed answer", () => {
    expect(
      typedLeaks("Rivers", "Which river flows through Vienna?", [
        "Danube",
        "Donau",
      ]),
    ).toBe(false);
    expect(
      typedLeaks("Rivers", "The Donau is known in English as?", [
        "Danube",
        "Donau",
      ]),
    ).toBe(true);
    expect(
      typedLeaks("Mountains", "Mount Everest is in which mountain range?", [
        "Himalaya",
      ]),
    ).toBe(false);
  });
});
