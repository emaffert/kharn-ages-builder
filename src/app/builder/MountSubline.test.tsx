// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { mountLabel, type ProfileInstance } from "@core";
import { catalog } from "@data";
import { MountSubline } from "./MountSubline";

afterEach(cleanup);

function mountedItem() {
  const mount = catalog.mounts[0];
  const p = catalog.profiles[0];
  const inst: ProfileInstance = {
    instanceId: "i1",
    profileId: p.id,
    addedEquipmentIds: [],
    removedBaseEquipmentIds: [],
    spellIds: [],
    mount: { mountId: mount.id },
  };
  return { x: { inst, p }, mount };
}

describe("MountSubline (vue)", () => {
  it("affiche le nom de la monture et son coût", () => {
    const { x, mount } = mountedItem();
    render(
      <MountSubline x={x} cat={catalog} mountCost={12} onOpen={() => {}} onRemove={() => {}} onPick={() => {}} />,
    );
    expect(screen.getByText(mountLabel(catalog, mount.id))).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Monture")).toBeTruthy();
  });

  it("appelle onRemove au clic sur la corbeille", () => {
    const { x } = mountedItem();
    const onRemove = vi.fn();
    render(
      <MountSubline x={x} cat={catalog} mountCost={0} onOpen={() => {}} onRemove={onRemove} onPick={() => {}} />,
    );
    fireEvent.click(screen.getByTitle("Retirer la monture"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("appelle onOpen au clic sur le nom", () => {
    const { x, mount } = mountedItem();
    const onOpen = vi.fn();
    render(
      <MountSubline x={x} cat={catalog} mountCost={0} onOpen={onOpen} onRemove={() => {}} onPick={() => {}} />,
    );
    fireEvent.click(screen.getByText(mountLabel(catalog, mount.id)));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
