import React, { useState, useRef, useEffect, useId } from "react";
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listboxId = useId();

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

  // Substring matching instead of prefix-only
  const filtered = stations.filter((s) => {
    if (excludeStation && s.toLowerCase() === excludeStation.toLowerCase()) return false;
    if (!query.trim()) return true;
    return s.toLowerCase().includes(query.trim().toLowerCase());
  });

  // Reset active index when the filtered list changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [filtered.length, query]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[role='option']");
    if (items[activeIndex]) {
      items[activeIndex].scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  function handleInputChange(e) {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    setActiveIndex(-1);
    // If user clears the input, clear the selection
    if (!val.trim()) {
      onChange("");
    }
  }

  function handleSelect(station) {
    setQuery(station);
    onChange(station);
    setOpen(false);
    setActiveIndex(-1);
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
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (e.key === "Tab") {
      setOpen(false);
      setActiveIndex(-1);
      if (query !== value) {
        setQuery(value || "");
      }
      return;
    }

    if (!open || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        handleSelect(filtered[activeIndex]);
      }
    }
  }

  const activeDescendant =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const dropdown =
    open && !disabled
      ? createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            className="station-autocomplete__dropdown"
            style={dropdownStyle}
            role="listbox"
            aria-label={`${label} suggestions`}
          >
            {filtered.length === 0 ? (
              <li
                className="station-autocomplete__item station-autocomplete__item--empty"
                role="option"
                aria-disabled="true"
                aria-selected="false"
              >
                No stations found
              </li>
            ) : (
              filtered.map((station, i) => (
                <li
                  key={station}
                  id={`${listboxId}-option-${i}`}
                  role="option"
                  aria-selected={station === value}
                  className={`station-autocomplete__item${
                    station === value ? " station-autocomplete__item--selected" : ""
                  }${i === activeIndex ? " station-autocomplete__item--active" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur before click registers
                    handleSelect(station);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
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
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && !disabled}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
        />
        {value && !disabled && (
          <button
            type="button"
            className="station-autocomplete__clear"
            onClick={() => {
              setQuery("");
              onChange("");
              setActiveIndex(-1);
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
  const needle = query.trim().toLowerCase();
  const idx = station.toLowerCase().indexOf(needle);
  if (idx === -1) return station;
  return (
    <>
      {station.slice(0, idx)}
      <span className="station-autocomplete__match">
        {station.slice(idx, idx + needle.length)}
      </span>
      {station.slice(idx + needle.length)}
    </>
  );
}
