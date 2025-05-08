import { Component, JSX, splitProps, children, useContext } from "solid-js";

import { AppContext, FileContext } from "@/CoiChatApp";

type LinkProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children?: JSX.Element;
};

export const NoteLink: Component<LinkProps> = (props) => {
  const [local, rest] = splitProps(props, ["href", "children"]);
  const c = children(() => local.children);
  const app = useContext(AppContext);
  const file = useContext(FileContext);

  const handleClick: JSX.EventHandlerUnion<HTMLAnchorElement, MouseEvent> = (
    e,
  ) => {
    e.preventDefault();
    if (!local.href) {
      return;
    }
    const filePath = file?.path ?? "";
    app?.workspace.openLinkText(local.href, filePath);
  };

  return (
    <a href={local.href} {...rest} onClick={handleClick}>
      {c()}
    </a>
  );
};
