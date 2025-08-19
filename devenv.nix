{ pkgs, ... }:

{
  packages = with pkgs; [
    git
  ];
  languages.go = {
    enable = true;
  };
}
