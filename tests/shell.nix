{ pkgs ? import <nixpkgs> {} }:

let
  # CHANGED: buildFHSUserEnv is now buildFHSEnv in modern NixOS channels
  fhs = pkgs.buildFHSEnv {
    name = "playwright-fhs-env";
    
    targetPkgs = pkgs: with pkgs; [
      nodejs_24

      # Needed for chromium
      alsa-lib
      atk
      cairo
      cups
      dbus
      expat
      fontconfig
      freetype
      gdk-pixbuf
      glib
      gtk3
      libdrm
      libxkbcommon
      mesa
      nspr
      nss
      pango
      systemd
      xorg.libX11
      xorg.libXcomposite
      xorg.libXdamage
      xorg.libXext
      xorg.libXfixes
      xorg.libXrandr
      xorg.libxcb
      zlib
      xorg.libXcursor
      xorg.libXi
      xorg.libXrender
      libgbm
      at-spi2-atk
      at-spi2-core

      # Needed for the tests
      lsof
    ];
    
    runScript = "bash";
  };
in
pkgs.stdenv.mkDerivation {
  name = "playwright-shell";
  nativeBuildInputs = [ fhs ];
  shellHook = "exec playwright-fhs-env";
}
