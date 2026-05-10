type PageHeaderProps = {
  title: string
  description?: string
}

export const PageHeader = ({ title, description }: PageHeaderProps) => {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
