import { randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { LibraryView } from "@/components/library-views";

export const dynamic = "force-dynamic";

export default async function Home() {
	const phrases = (await readFile(path.join(process.cwd(), "phrases.txt"), "utf8")).split(/\r?\n/).map((phrase) => phrase.trim()).filter(Boolean);
	const greetingTemplate = phrases.length ? phrases[randomInt(phrases.length)] : "Добро пожаловать в библиотеку.";
	return <LibraryView greetingTemplate={greetingTemplate} />;
}
