<script>
	import Card from "./Card.svelte";
	import CardHeader from "./CardHeader.svelte";
	import CardBody from "./CardBody.svelte";
</script>

<main>
	<Card>
		<CardHeader />
		<CardBody />
	</Card>
</main>

<style>
	main {
		text-align: center;
		padding: 35px;
		max-width: 240px;
		margin: 0 auto;
	}
</style>