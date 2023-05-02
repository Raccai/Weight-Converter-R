<script>
    import Button from "./Button.svelte";

    let form = document.querySelector("form");
    let weights = {
        ounces: 0,
        kgrams: 0,
        pounds: 0,
        grams: 0,
        stones: 0,
        tons: 0,
    }

    const convertWeight = (e) => {
        if (e.target.classList.contains("ounces")){
            let x = e.target.value;
            weights.kgrams = (x* 0.028349523).toFixed(2);
            weights.pounds = (x/16).toFixed(2);
            weights.grams = (x*28.34952).toFixed(2);
            weights.stones = (x*0.00446428571429).toFixed(2);
            weights.tons = (x/32000).toFixed(2);
        }

        if (e.target.classList.contains("kgrams")){
            let x = e.target.value;
            weights.ounces = (x*35.274).toFixed(2);
            weights.pounds = (x*2.2).toFixed(2);
            weights.grams = (x*1000).toFixed(2);
            weights.stones = (x*0.1575).toFixed(2);
            weights.tons = (x*0.001).toFixed(2);
        }

        if (e.target.classList.contains("pounds")){
            let x = e.target.value;
            weights.ounces = (x*16).toFixed(2);
            weights.kgrams = (x*0.45359237).toFixed(2);
            weights.grams = (x*453.59237).toFixed(2);
            weights.stones = (x/14).toFixed(2);
            weights.tons = (x/2000).toFixed(2);
        }

        if (e.target.classList.contains("grams")){
            let x = e.target.value;
            weights.ounces = (x/28.34952).toFixed(2);
            weights.pounds = (x*0.002205).toFixed(2);
            weights.kgrams = (x/1000).toFixed(2);
            weights.stones = (x*0.000157473).toFixed(2);
            weights.tons = (x*1.1023E-6).toFixed(2);
        }

        if (e.target.classList.contains("stones")){
            let x = e.target.value;
            weights.ounces = (x*224).toFixed(2);
            weights.pounds = (x*2.2).toFixed(2);
            weights.grams = (x/0.00015747).toFixed(2);
            weights.kgrams = (x*6.35029).toFixed(2);
            weights.tons = (x/157.47).toFixed(2);
        }

        if (e.target.classList.contains("tons")){
            let x = e.target.value;
            weights.ounces = (x*32000).toFixed(2);
            weights.pounds = (x/ 0.0004535923700100354).toFixed(2);
            weights.grams = (x*907184.74).toFixed(2);
            weights.stones = (x*157.473).toFixed(2);
            weights.kgrams = (x*1000).toFixed(2);
        }   
    }

    const resetWeights = () => {
        weights.ounces = 0;
        weights.kgrams = 0;
        weights.pounds = 0;
        weights.grams = 0;
        weights.stones = 0;
        weights.tons = 0;
    };
</script>

<form>
    <div class="form-input">
        <label for="ounces">Ounces:</label>
        <input class="ounces" type="number" bind:value={weights.ounces} on:click = {convertWeight} on:input= {convertWeight}>
    </div>
    <div class="form-input">
        <label for="kgrams">Kilograms:</label>
        <input class="kgrams" type="number" bind:value={weights.kgrams} on:click = {convertWeight} on:input= {convertWeight}>
    </div>
    <div class="form-input">
        <label for="pounds">Pounds:</label>
        <input class="pounds" type="number" bind:value={weights.pounds} on:click = {convertWeight} on:input= {convertWeight}>
    </div>
    <div class="form-input">
        <label for="grams">Grams:</label>
        <input class="grams" type="number" bind:value={weights.grams} on:click = {convertWeight} on:input= {convertWeight}>
    </div>
    <div class="form-input">
        <label for="stones">Stones:</label>
        <input class="stones" type="number" bind:value={weights.stones} on:click = {convertWeight} on:input= {convertWeight}>
    </div>
    <div class="form-input">
        <label for="tons">Tons:</label>
        <input class="tons" type="number" bind:value={weights.tons} on:click = {convertWeight} on:input= {convertWeight}>
    </div>
</form>

<Button on:click = {resetWeights}>Reset</Button>

<style>
    form {
        color: #000;
        text-shadow: none;
        display: grid;
        grid-template-columns: 90px 100px;
        grid-template-rows: 80px 80px 80px;
        column-gap: 100px;
        padding: 40px 20px;
        margin: 0 0 -80px 5px;
    }

    .form-input {
        display: flex;
        flex-direction: column;
        width: 180px;
    }

    label {
        font-size: 15px;
        padding-bottom: 5px;
    }

    input[type="number"] {
        width: 100%;
    }
</style>