import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom does not implement scrolling.
window.scrollTo = () => {};
Element.prototype.scrollIntoView = function scrollIntoView() {};

afterEach(() => cleanup());
