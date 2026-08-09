export function createInput({
  type = "text",
  name,
  placeholder = "",
  value = "",
  label,
  ariaLabel,
  error,
  className = "",
  onInput,
} = {}) {
  const wrap = document.createElement("label");
  wrap.className = ["ui-field", className].filter(Boolean).join(" ");

  if (label) {
    const lab = document.createElement("span");
    lab.className = "ui-field__label";
    lab.textContent = label;
    wrap.append(lab);
  }

  const input = document.createElement("input");
  input.type = type;
  input.className = "ui-input";
  if (name) input.name = name;
  input.placeholder = placeholder;
  input.value = value;
  if (ariaLabel) input.setAttribute("aria-label", ariaLabel);
  if (onInput) input.addEventListener("input", onInput);
  wrap.append(input);

  if (error) {
    const err = document.createElement("span");
    err.className = "ui-field__error";
    err.textContent = error;
    wrap.append(err);
    input.setAttribute("aria-invalid", "true");
  }

  wrap.getValue = () => input.value;
  wrap.setValue = (v) => {
    input.value = v;
  };
  wrap.input = input;
  return wrap;
}
