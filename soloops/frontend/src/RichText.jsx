// tiny safe renderer: **bold** -> <strong>, no dangerouslySetInnerHTML
export default function RichText({ text }) {
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        )
      )}
    </>
  );
}
