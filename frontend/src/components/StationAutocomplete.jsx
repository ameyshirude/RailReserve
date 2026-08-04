import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import "./StationAutocomplete.css";

export default function StationAutocomplete({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  stations = [],
  excludeStation = "",
}) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Keep query in sync with external value changes (e.g. restored pending booking)
  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  // Position the dropdown relative to the input using fixed positioning
  useEffect(() => {
    if (!open || !inputRef.current) return;

    function updatePosition() {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target) &&
        !e.target.closest(".station-autocomplete__dropdown")
      ) {
        setOpen(false);
        // If user typed something that isn't a valid station, revert to last valid value
        if (query !== value) {
          setQuery(value || "");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [query, value]);

  const filtered = stations.filter((s) => {
    if (excludeStation && s.toLowerCase() === excludeStation.toLowerCase()) return false;
    if (!query.trim()) return true;
    return s.toLowerCase().startsWith(query.trim().toLowerCase());
  });

  function handleInputChange(e) {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    // If user clears the input, clear the selection
    if (!val.trim()) {
      onChange("");
    }
  }

  function handleSelect(station) {
    setQuery(station);
    onChange(station);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleFocus() {
    if (!disabled) {
      setOpen(true);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery(value || "");
      inputRef.current?.blur();
    }
    if (e.key === "Tab") {
      setOpen(false);
      if (query !== value) {
        setQuery(value || "");
      }
    }
  }

  const dropdown =
    open && !disabled
      ? createPortal(
          <ul className="station-autocomplete__dropdown" style={dropdownStyle}>
            {filtered.length === 0 ? (
              <li className="station-autocomplete__item station-autocomplete__item--empty">
                No stations found
              </li>
            ) : (
              filtered.map((station) => (
                <li
                  key={station}
                  className={`station-autocomplete__item${
                    station === value ? " station-autocomplete__item--selected" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur before click registers
                    handleSelect(station);
                  }}
                >
                  {highlightMatch(station, query)}
                </li>
              ))
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className="station-autocomplete" ref={wrapperRef}>
      <label
        htmlFor={id}
        className="form-label"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.80rem",
          fontStyle: "italic",
        }}
      >
        {label}
      </label>
      <div className="station-autocomplete__input-wrap">
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="form-control"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required
          autoComplete="off"
        />
        {value && !disabled && (
          <button
            type="button"
            className="station-autocomplete__clear"
            onClick={() => {
              setQuery("");
              onChange("");
              inputRef.current?.focus();
            }}
            tabIndex={-1}
            aria-label="Clear station"
          >
            ×
          </button>
        )}
      </div>
      {dropdown}
    </div>
  );
}

function highlightMatch(station, query) {
  if (!query.trim()) return station;
  const len = query.trim().length;
  return (
    <>
      <span className="station-autocomplete__match">{station.slice(0, len)}</span>
      {station.slice(len)}
    </>
  );
}

