import { nanoid } from "nanoid";
import { useEffect, useState } from "react";

const ANIMALS = [
  "cat",
  "dog",
  "mouse",
  "rabbit",
  "hamster",
  "guinea pig",
  "rabbit",
  "hamster",
  "guinea pig",
  "rabbit",
  "hamster",
  "guinea pig",
];

const STORAGE_KEY = "chat_username";

const generateUserName = () => {
  const randomAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `anonymous-${randomAnimal}-${nanoid(5)}`;
};

export const useUsername = () => {
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    const main = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUsername(stored);
        return;
      } else {
        const generated = generateUserName();
        localStorage.setItem(STORAGE_KEY, generated);
        setUsername(generated);
      }
    };

    main();
  }, []);

  return { username };
};
